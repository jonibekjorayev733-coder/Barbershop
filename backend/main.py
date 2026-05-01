from fastapi import FastAPI, Depends, HTTPException, status, Header, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, func, and_, or_
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import List, Optional, Dict, Set
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import asyncio
import calendar
import math
import logging
import os
import json
import urllib.request
import urllib.parse
import base64
import hmac
import hashlib
import uuid
import random
import threading

try:
    import redis
except ImportError:  # pragma: no cover
    redis = None

try:
    import models, schemas
    from database import engine, get_db
    from auth import hash_password, verify_password, create_access_token, decode_access_token
    from payment_gateways import PaymentProcessor, StripePaymentService
except ImportError:
    from . import models, schemas
    from .database import engine, get_db
    from .auth import hash_password, verify_password, create_access_token, decode_access_token
    from .payment_gateways import PaymentProcessor, StripePaymentService

# Create tables
# models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="EduGrow Platform API")

logger = logging.getLogger("realtime")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

redis_client = None
REDIS_DEFAULT_TTL_SECONDS = int(os.getenv("REDIS_CACHE_TTL", "60"))
telegram_bot_username_cache = ""
REDIS_URL = os.getenv("REDIS_URL", "").strip()
REALTIME_REDIS_CHANNEL = os.getenv("REALTIME_REDIS_CHANNEL", "realtime:events")
INSTANCE_ID = os.getenv("INSTANCE_ID", str(uuid.uuid4()))
MAX_WS_TOTAL_CONNECTIONS = int(os.getenv("MAX_WS_TOTAL_CONNECTIONS", "800"))
MAX_WS_CHANNEL_CONNECTIONS = int(os.getenv("MAX_WS_CHANNEL_CONNECTIONS", "250"))
MAX_WS_USER_CONNECTIONS = int(os.getenv("MAX_WS_USER_CONNECTIONS", "30"))
PHONE_OTP_EXPIRY_SECONDS = int(os.getenv("PHONE_OTP_EXPIRY_SECONDS", "300"))
PHONE_OTP_RESEND_SECONDS = int(os.getenv("PHONE_OTP_RESEND_SECONDS", "45"))
PHONE_OTP_DEBUG = os.getenv("PHONE_OTP_DEBUG", "false").strip().lower() in {"1", "true", "yes", "on"}

REALTIME_METRICS: Dict[str, int] = {
    "ws_connected": 0,
    "ws_auth_failed": 0,
    "ws_rejected": 0,
    "ws_messages_out": 0,
    "ws_send_errors": 0,
    "redis_publish_errors": 0,
    "redis_receive_errors": 0,
}

metrics_lock = threading.Lock()
redis_realtime_listener_stop = threading.Event()
redis_realtime_listener_thread: Optional[threading.Thread] = None


def inc_metric(name: str, amount: int = 1):
    with metrics_lock:
        REALTIME_METRICS[name] = int(REALTIME_METRICS.get(name, 0)) + amount


def init_redis_client():
    global redis_client
    redis_url = os.getenv("REDIS_URL")
    if not redis_url or redis is None:
        redis_client = None
        return
    try:
        redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
        redis_client.ping()
        print("[CACHE] Redis connected")
    except Exception as cache_error:
        redis_client = None
        print(f"[CACHE] Redis disabled: {cache_error}")


def cache_get_json(cache_key: str):
    if redis_client is None:
        return None
    try:
        raw = redis_client.get(cache_key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


def cache_set_json(cache_key: str, value, ttl_seconds: int = REDIS_DEFAULT_TTL_SECONDS):
    if redis_client is None:
        return
    try:
        redis_client.setex(cache_key, ttl_seconds, json.dumps(value, default=str))
    except Exception:
        return


def cache_delete_prefix(prefix: str):
    if redis_client is None:
        return
    try:
        for key in redis_client.scan_iter(match=f"{prefix}*"):
            redis_client.delete(key)
    except Exception:
        return


def invalidate_reference_caches():
    cache_delete_prefix("courses:")
    cache_delete_prefix("teachers:")
    cache_delete_prefix("students:")
    cache_delete_prefix("enrollments:")


def serialize_enrollment_row(enrollment: models.CourseEnrollment):
    return {
        "id": enrollment.id,
        "student_id": enrollment.student_id,
        "course_id": enrollment.course_id,
        "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
    }

# Configure CORS
default_allowed_origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://kursboshqaruvi-frontend.onrender.com",
    "https://barbershop-1-gvrz.onrender.com",  # Frontend Render URL
    "https://barbershop-q8eb.onrender.com",    # Backend Render URL
]

env_allowed_origins_raw = os.getenv("CORS_ORIGINS", "")
env_allowed_origins = [origin.strip() for origin in env_allowed_origins_raw.split(",") if origin.strip()]
allowed_origins = list(dict.fromkeys(default_allowed_origins + env_allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"(https?://(localhost|127\.0\.0\.1)(:\d+)?$)|(https?://[\w\-]+\.onrender\.com$)",
)

init_redis_client()


class NotificationConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        user_connections = self.active_connections.get(user_id)
        if user_connections and len(user_connections) >= MAX_WS_USER_CONNECTIONS:
            inc_metric("ws_rejected")
            await websocket.close(code=1013, reason="Too many connections")
            return False

        await websocket.accept()
        user_connections = self.active_connections.setdefault(user_id, set())
        user_connections.add(websocket)
        inc_metric("ws_connected")
        return True

    def disconnect(self, user_id: int, websocket: WebSocket):
        user_connections = self.active_connections.get(user_id)
        if not user_connections:
            return
        user_connections.discard(websocket)
        inc_metric("ws_connected", -1)
        if not user_connections:
            self.active_connections.pop(user_id, None)

    def total_connections(self) -> int:
        return sum(len(items) for items in self.active_connections.values())

    def is_online(self, user_id: int) -> bool:
        user_connections = self.active_connections.get(user_id)
        return bool(user_connections)

    async def broadcast_to_user(self, user_id: int, payload: dict):
        user_connections = self.active_connections.get(user_id)
        if not user_connections:
            return

        disconnected: List[WebSocket] = []
        for connection in list(user_connections):
            try:
                await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(user_id, connection)
            inc_metric("ws_send_errors")


notification_manager = NotificationConnectionManager()


class RealtimeChannelManager:
    def __init__(self):
        self.channels: Dict[str, Set[WebSocket]] = {}

    async def connect(self, channel: str, websocket: WebSocket):
        listeners = self.channels.get(channel)
        if listeners and len(listeners) >= MAX_WS_CHANNEL_CONNECTIONS:
            inc_metric("ws_rejected")
            await websocket.close(code=1013, reason="Channel busy")
            return False

        await websocket.accept()
        listeners = self.channels.setdefault(channel, set())
        listeners.add(websocket)
        inc_metric("ws_connected")
        return True

    def disconnect(self, channel: str, websocket: WebSocket):
        listeners = self.channels.get(channel)
        if not listeners:
            return
        listeners.discard(websocket)
        inc_metric("ws_connected", -1)
        if not listeners:
            self.channels.pop(channel, None)

    def total_connections(self) -> int:
        return sum(len(items) for items in self.channels.values())

    async def broadcast(self, channel: str, payload: dict):
        listeners = self.channels.get(channel)
        if not listeners:
            return

        broken: List[WebSocket] = []
        for socket in list(listeners):
            try:
                await socket.send_json(payload)
            except Exception:
                broken.append(socket)

        for socket in broken:
            self.disconnect(channel, socket)
            inc_metric("ws_send_errors")


realtime_manager = RealtimeChannelManager()
app_event_loop: Optional[asyncio.AbstractEventLoop] = None

TASHKENT_TZ = ZoneInfo("Asia/Tashkent")


def now_tashkent() -> datetime:
    return datetime.now(TASHKENT_TZ).replace(tzinfo=None)


def today_tashkent_str() -> str:
    return datetime.now(TASHKENT_TZ).strftime("%Y-%m-%d")


def schedule_realtime(channel: str, event: str, data: dict):
    event_id = str(uuid.uuid4())
    sent_at_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    payload = {
        "event_id": event_id,
        "event": event,
        "channel": channel,
        "timestamp": now_tashkent().isoformat(),
        "sent_at_ms": sent_at_ms,
        "source_instance": INSTANCE_ID,
        "data": data,
    }

    async def send_realtime() -> None:
        await realtime_manager.broadcast(channel, payload)
        inc_metric("ws_messages_out")

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_realtime())
    except RuntimeError:
        if app_event_loop and app_event_loop.is_running():
            app_event_loop.call_soon_threadsafe(lambda: app_event_loop.create_task(send_realtime()))
        else:
            asyncio.run(send_realtime())

    publish_realtime_to_redis(payload)


def push_notification_realtime(user_id: int, payload: dict):
    async def send_notification() -> None:
        await notification_manager.broadcast_to_user(user_id, payload)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_notification())
    except RuntimeError:
        if app_event_loop and app_event_loop.is_running():
            app_event_loop.call_soon_threadsafe(lambda: app_event_loop.create_task(send_notification()))
        else:
            asyncio.run(send_notification())


def emit_role_events(role: str, event: str, data: dict, user_id: Optional[int] = None):
    if user_id is not None and role in {"student", "teacher"}:
        schedule_realtime(f"{role}:{user_id}", event, data)
        return

    schedule_realtime(role, event, data)
    if user_id is not None:
        schedule_realtime(f"{role}:{user_id}", event, data)


def publish_realtime_to_redis(payload: dict):
    if redis_client is None:
        return
    try:
        redis_client.publish(REALTIME_REDIS_CHANNEL, json.dumps(payload, default=str))
    except Exception as redis_publish_error:
        inc_metric("redis_publish_errors")
        logger.warning("[REALTIME] Redis publish error: %s", redis_publish_error)


def handle_redis_realtime_message(raw_payload: str):
    try:
        payload = json.loads(raw_payload)
    except Exception:
        inc_metric("redis_receive_errors")
        return

    if not isinstance(payload, dict):
        return

    if payload.get("source_instance") == INSTANCE_ID:
        return

    channel = payload.get("channel")
    if not isinstance(channel, str) or not channel:
        return

    async def broadcast_from_redis() -> None:
        await realtime_manager.broadcast(channel, payload)
        inc_metric("ws_messages_out")

    if app_event_loop and app_event_loop.is_running():
        app_event_loop.call_soon_threadsafe(lambda: app_event_loop.create_task(broadcast_from_redis()))


def start_redis_realtime_listener():
    global redis_realtime_listener_thread
    if redis is None or not REDIS_URL or redis_realtime_listener_thread is not None:
        return

    def listener_worker():
        pubsub_client = None
        pubsub = None
        try:
            pubsub_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
            pubsub = pubsub_client.pubsub(ignore_subscribe_messages=True)
            pubsub.subscribe(REALTIME_REDIS_CHANNEL)
            logger.info("[REALTIME] Redis listener started on %s", REALTIME_REDIS_CHANNEL)

            while not redis_realtime_listener_stop.is_set():
                message = pubsub.get_message(timeout=1.0)
                if not message:
                    continue

                if message.get("type") != "message":
                    continue

                data = message.get("data")
                if isinstance(data, str):
                    handle_redis_realtime_message(data)
        except Exception as listener_error:
            inc_metric("redis_receive_errors")
            logger.warning("[REALTIME] Redis listener error: %s", listener_error)
        finally:
            try:
                if pubsub:
                    pubsub.close()
                if pubsub_client:
                    pubsub_client.close()
            except Exception:
                pass

    redis_realtime_listener_stop.clear()
    redis_realtime_listener_thread = threading.Thread(target=listener_worker, name="redis-realtime-listener", daemon=True)
    redis_realtime_listener_thread.start()


def stop_redis_realtime_listener():
    global redis_realtime_listener_thread
    redis_realtime_listener_stop.set()
    if redis_realtime_listener_thread and redis_realtime_listener_thread.is_alive():
        redis_realtime_listener_thread.join(timeout=2)
    redis_realtime_listener_thread = None


def parse_ws_token(websocket: WebSocket) -> Optional[str]:
    raw_authorization = websocket.headers.get("authorization", "")
    if raw_authorization.lower().startswith("bearer "):
        token = raw_authorization[7:].strip()
        if token:
            return token

    query_token = websocket.query_params.get("token")
    if query_token:
        return query_token.strip()

    return None


def to_int(value: object) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except Exception:
        return None


async def authenticate_ws(websocket: WebSocket) -> Optional[dict]:
    token = parse_ws_token(websocket)
    if not token:
        inc_metric("ws_auth_failed")
        await websocket.close(code=1008, reason="Missing token")
        return None

    payload = decode_access_token(token)
    if not payload:
        inc_metric("ws_auth_failed")
        await websocket.close(code=1008, reason="Invalid token")
        return None

    return payload


def ws_total_connections() -> int:
    return notification_manager.total_connections() + realtime_manager.total_connections()


def can_subscribe_channel(channel: str, auth_payload: dict) -> bool:
    role = str(auth_payload.get("role") or "").strip().lower()
    token_user_id = to_int(auth_payload.get("user_id"))

    if role == "admin":
        return True

    if channel in {"bookings", "admin", "barber", "student", "teacher"}:
        return role in {"barber", "student", "user", "teacher"}

    if channel.startswith("barber:"):
        channel_id = to_int(channel.split(":", 1)[1])
        if channel_id is None:
            return False
        return role in {"student", "user"} or (role == "barber" and token_user_id == channel_id)

    if channel.startswith("student:"):
        channel_id = to_int(channel.split(":", 1)[1])
        if channel_id is None:
            return False
        return role in {"student", "user"} and token_user_id == channel_id

    if channel.startswith("teacher:"):
        channel_id = to_int(channel.split(":", 1)[1])
        if channel_id is None:
            return False
        return role == "teacher" and token_user_id == channel_id

    return False


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def serialize_public_barber(barber: models.Barber) -> dict:
    return {
        "id": barber.id,
        "name": barber.name,
        "specialty": barber.specialty,
        "photo_url": barber.photo_url,
        "years_experience": barber.years_experience,
        "rating": float(barber.rating or 0),
    }


def serialize_public_barbershop(shop: models.Barbershop, user_lat: Optional[float], user_lon: Optional[float]) -> dict:
    distance_km = None
    if user_lat is not None and user_lon is not None:
        distance_km = round(haversine_distance_km(user_lat, user_lon, shop.latitude, shop.longitude), 2)

    active_barbers = [item for item in shop.barbers if item.status != "off"]

    return {
        "id": shop.id,
        "name": shop.name,
        "address": shop.address,
        "latitude": shop.latitude,
        "longitude": shop.longitude,
        "photo_url": shop.photo_url,
        "description": shop.description,
        "distance_km": distance_km,
        "barber_count": len(active_barbers),
        "barbers": [serialize_public_barber(item) for item in active_barbers],
    }


def parse_client_ip(request: Request) -> Optional[str]:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        first = forwarded_for.split(",", 1)[0].strip()
        if first:
            return first

    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip

    if request.client and request.client.host:
        return request.client.host

    return None


def _http_get_json(url: str, timeout: int = 6) -> dict:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if not (200 <= response.status < 300):
            raise ValueError(f"HTTP {response.status}")
        return json.loads(response.read().decode("utf-8"))


def resolve_location_by_ip(ip_address: Optional[str]) -> Optional[dict]:
    safe_ip = (ip_address or "").strip()
    query_target = urllib.parse.quote(safe_ip) if safe_ip else ""
    providers = [
        (f"https://ipapi.co/{query_target}/json/" if query_target else "https://ipapi.co/json/", "ipapi"),
        (f"http://ip-api.com/json/{query_target}" if query_target else "http://ip-api.com/json/", "ip-api"),
    ]

    for url, provider in providers:
        try:
            payload = _http_get_json(url, timeout=7)

            if provider == "ipapi":
                lat = payload.get("latitude")
                lng = payload.get("longitude")
                city = payload.get("city")
                region = payload.get("region") or payload.get("region_code")
                country = payload.get("country_name") or payload.get("country")
                timezone_value = payload.get("timezone")
            else:
                if str(payload.get("status", "")).lower() != "success":
                    continue
                lat = payload.get("lat")
                lng = payload.get("lon")
                city = payload.get("city")
                region = payload.get("regionName") or payload.get("region")
                country = payload.get("country")
                timezone_value = payload.get("timezone")

            if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                return {
                    "lat": float(lat),
                    "lng": float(lng),
                    "city": str(city or "").strip() or None,
                    "region": str(region or "").strip() or None,
                    "country": str(country or "").strip() or None,
                    "timezone": str(timezone_value or "").strip() or None,
                    "source": provider,
                }
        except Exception:
            continue

    return None


def seed_barbershops_if_empty(db: Session) -> None:
    seed_payloads = [
        {
            "name": "Chilonzor Premium Cuts",
            "address": "Chilonzor, Toshkent",
            "latitude": 41.2752,
            "longitude": 69.2036,
            "photo_url": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=80",
            "description": "Zamonaviy uslub, premium xizmat va toza muhit.",
        },
        {
            "name": "Yunusobod Gentlemen Club",
            "address": "Yunusobod, Toshkent",
            "latitude": 41.3631,
            "longitude": 69.2882,
            "photo_url": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=80",
            "description": "Klassik va modern kesimlar, tajribali ustalar.",
        },
        {
            "name": "Sergeli Urban Barber",
            "address": "Sergeli, Toshkent",
            "latitude": 41.2266,
            "longitude": 69.2197,
            "photo_url": "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=1200&q=80",
            "description": "Tezkor bron va qulay narxlar bilan xizmat.",
        },
        {
            "name": "Buxoro Old City Barber",
            "address": "Eski shahar, Buxoro",
            "latitude": 39.7747,
            "longitude": 64.4286,
            "photo_url": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80",
            "description": "Buxoro markazida klassik va zamonaviy uslubdagi xizmatlar.",
        },
        {
            "name": "Buxoro City Fade Studio",
            "address": "Buxoro shahri, Mustaqillik ko'chasi",
            "latitude": 39.7678,
            "longitude": 64.4554,
            "photo_url": "https://images.unsplash.com/photo-1503951458645-643d53c5d7c4?auto=format&fit=crop&w=1200&q=80",
            "description": "Fade, beard styling va premium servislar.",
        },
    ]

    existing_names = {
        (str(item.name or "").strip().lower())
        for item in db.query(models.Barbershop).all()
    }

    created_any = False
    for payload in seed_payloads:
        normalized_name = str(payload["name"]).strip().lower()
        if normalized_name in existing_names:
            continue
        db.add(models.Barbershop(**payload))
        existing_names.add(normalized_name)
        created_any = True

    if created_any:
        db.commit()

    db_barbers = db.query(models.Barber).order_by(models.Barber.id.asc()).all()
    shops = db.query(models.Barbershop).order_by(models.Barbershop.id.asc()).all()
    if not shops:
        return

    for index, barber in enumerate(db_barbers):
        if barber.barbershop_id is None:
            barber.barbershop_id = shops[index % len(shops)].id

    db.commit()


@app.get("/public/location-by-ip", response_model=schemas.PublicUserLocation)
def get_public_location_by_ip(request: Request):
    client_ip = parse_client_ip(request)
    location = resolve_location_by_ip(client_ip)

    if not location:
        raise HTTPException(status_code=503, detail="IP bo'yicha joylashuv aniqlanmadi")

    return {
        "lat": location["lat"],
        "lng": location["lng"],
        "city": location.get("city"),
        "region": location.get("region"),
        "country": location.get("country"),
        "timezone": location.get("timezone"),
        "source": location.get("source") or "unknown",
        "is_exact": False,
    }


def notification_to_payload(notification: models.Notification) -> dict:
    created_at_value = notification.created_at.isoformat() if notification.created_at else None
    return {
        "event": "notification.created",
        "notification": {
            "id": notification.id,
            "user_id": notification.user_id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "assignment_id": notification.assignment_id,
            "read": notification.read,
            "created_at": created_at_value,
        },
    }


def appointment_realtime_payload(appointment: models.BarberAppointment, barber_name: Optional[str] = None) -> dict:
    return {
        "appointment_id": appointment.id,
        "booking_id": format_booking_code(appointment.id),
        "barber_id": appointment.barber_id,
        "barber_name": barber_name,
        "client_name": appointment.client_name,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
        "status": appointment.status,
        "service_name": appointment.service_name,
        "created_at": appointment.created_at.isoformat() if appointment.created_at else None,
        "updated_at": appointment.updated_at.isoformat() if appointment.updated_at else None,
    }


def _eskiz_get_token() -> Optional[str]:
    """Fetch a fresh Eskiz.uz bearer token using EMAIL + PASSWORD env vars."""
    email = os.getenv("ESKIZ_EMAIL", "").strip()
    password = os.getenv("ESKIZ_PASSWORD", "").strip()
    if not email or not password:
        return None
    try:
        data = urllib.parse.urlencode({"email": email, "password": password}).encode("utf-8")
        req = urllib.request.Request(
            "https://notify.eskiz.uz/api/auth/login",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            token = (body.get("data") or {}).get("token")
            if token:
                return token
    except Exception as exc:
        print(f"[Eskiz] auth failed: {exc}")
    return None


def _eskiz_send(phone: str, message: str, token: str) -> bool:
    """Send SMS via Eskiz.uz using the given bearer token."""
    sender_id = os.getenv("ESKIZ_SENDER", "4546").strip()  # default test sender
    try:
        form_data = urllib.parse.urlencode({
            "mobile_phone": phone,
            "message": message,
            "from": sender_id,
            "callback_url": "",
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://notify.eskiz.uz/api/message/sms/send",
            data=form_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Bearer {token}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            status_val = (body.get("status") or "").lower()
            return status_val == "waiting" or status_val == "success"
    except Exception as exc:
        print(f"[Eskiz] send failed: {exc}")
    return False


def send_sms_via_webhook(phone: Optional[str], message: str) -> bool:
    if not phone:
        return False

    # --- Try Eskiz.uz first ---
    if os.getenv("ESKIZ_EMAIL", "").strip() and os.getenv("ESKIZ_PASSWORD", "").strip():
        token = _eskiz_get_token()
        if token:
            ok = _eskiz_send(phone, message, token)
            if ok:
                return True
            print("[Eskiz] send returned False, falling back to webhook")

    # --- Fallback: generic webhook (SMS_API_URL + SMS_API_TOKEN) ---
    sms_api_url = os.getenv("SMS_API_URL", "").strip()
    sms_api_token = os.getenv("SMS_API_TOKEN", "").strip()

    if not sms_api_url:
        return False

    payload = json.dumps({"phone": phone, "message": message}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if sms_api_token:
        headers["Authorization"] = f"Bearer {sms_api_token}"

    try:
        request = urllib.request.Request(sms_api_url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(request, timeout=8) as response:
            return 200 <= response.status < 300
    except Exception as exc:
        print(f"[WARNING] SMS webhook send failed: {exc}")
        return False


def normalize_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    return "".join(ch for ch in str(phone) if ch.isdigit())


def generate_phone_otp_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def phone_placeholder_email(phone: str) -> str:
    return f"{normalize_phone(phone)}@phone.local"


def is_phone_placeholder_email(email_value: Optional[str]) -> bool:
    return str(email_value or "").strip().lower().endswith("@phone.local")


def build_login_response(user_id: int, role: str, name: str, email: Optional[str], avatar: Optional[str], phone: Optional[str] = None) -> dict:
    normalized_role = (role or "student").strip().lower()
    access_token = create_access_token({"user_id": user_id, "role": normalized_role})
    safe_email = "" if is_phone_placeholder_email(email) else str(email or "")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user_id,
        "role": normalized_role,
        "name": name,
        "email": safe_email,
        "phone": phone,
        "avatar": avatar,
    }


def find_identity_by_phone(db: Session, phone: str):
    normalized_target = normalize_phone(phone)
    if not normalized_target:
        return None, None

    admins = db.query(models.Admin).all()
    for admin in admins:
        if normalize_phone(getattr(admin, "phone", None)) == normalized_target:
            return "admin", admin

    barbers = db.query(models.Barber).all()
    for barber in barbers:
        if normalize_phone(barber.phone) == normalized_target:
            return "barber", barber

    students = db.query(models.Student).all()
    for student in students:
        if normalize_phone(student.phone) == normalized_target:
            return "student", student

    return None, None


def create_phone_student_account(db: Session, name: str, phone: str) -> models.Student:
    normalized_phone = normalize_phone(phone)
    normalized_name = (name or "").strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Yangi foydalanuvchi uchun ism majburiy")

    placeholder_email = phone_placeholder_email(normalized_phone)
    existing_student = db.query(models.Student).filter(func.lower(models.Student.email) == placeholder_email.lower()).first()
    if existing_student:
        existing_student.phone = normalized_phone
        existing_student.name = existing_student.name or normalized_name
        db.commit()
        db.refresh(existing_student)
        return existing_student

    student = models.Student(
        name=normalized_name,
        email=placeholder_email,
        password=hash_password(uuid.uuid4().hex + normalized_phone),
        phone=normalized_phone,
        role="student",
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def save_phone_otp_request(db: Session, phone: str, name: Optional[str]) -> dict:
    normalized_phone = normalize_phone(phone)
    if not normalized_phone:
        raise HTTPException(status_code=400, detail="Telefon raqam noto'g'ri")

    now_value = now_tashkent()
    latest_row = db.execute(
        text(
            """
            SELECT id, created_at
            FROM phone_otp_auth
            WHERE phone = :phone AND is_used = FALSE AND expires_at > :now_value
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"phone": normalized_phone, "now_value": now_value},
    ).mappings().first()

    if latest_row and latest_row.get("created_at"):
        created_at = latest_row["created_at"]
        if isinstance(created_at, datetime) and (now_value - created_at).total_seconds() < PHONE_OTP_RESEND_SECONDS:
            raise HTTPException(status_code=429, detail="SMS kod yaqinda yuborilgan. Biroz kutib qayta urinib ko'ring")

    otp_code = generate_phone_otp_code()
    expires_at = now_value + timedelta(seconds=PHONE_OTP_EXPIRY_SECONDS)
    db.execute(text("UPDATE phone_otp_auth SET is_used = TRUE, used_at = :now_value WHERE phone = :phone AND is_used = FALSE"), {
        "now_value": now_value,
        "phone": normalized_phone,
    })
    db.execute(
        text(
            """
            INSERT INTO phone_otp_auth (phone, code, name, expires_at, created_at)
            VALUES (:phone, :code, :name, :expires_at, :created_at)
            """
        ),
        {
            "phone": normalized_phone,
            "code": otp_code,
            "name": (name or "").strip() or None,
            "expires_at": expires_at,
            "created_at": now_value,
        },
    )
    db.commit()

    sent = send_sms_via_webhook(normalized_phone, f"Sharp Cuts tasdiqlash kodi: {otp_code}. Kod {PHONE_OTP_EXPIRY_SECONDS // 60} daqiqa amal qiladi.")
    return {
        "success": True,
        "phone": normalized_phone,
        "expires_in_seconds": PHONE_OTP_EXPIRY_SECONDS,
        "delivery_status": "sent" if sent else "debug",
        "debug_code": None if sent and not PHONE_OTP_DEBUG else otp_code,
        "message": "SMS kod yuborildi" if sent else "SMS provider topilmadi, debug kod qaytarildi",
    }


def verify_phone_otp_and_login(db: Session, phone: str, code: str, name: Optional[str]) -> dict:
    normalized_phone = normalize_phone(phone)
    normalized_code = "".join(ch for ch in str(code or "") if ch.isdigit())
    if not normalized_phone or len(normalized_code) != 6:
        raise HTTPException(status_code=400, detail="Telefon yoki SMS kodi noto'g'ri")

    now_value = now_tashkent()
    row = db.execute(
        text(
            """
            SELECT id, phone, code, name, expires_at, attempts
            FROM phone_otp_auth
            WHERE phone = :phone AND is_used = FALSE
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"phone": normalized_phone},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Bu telefon uchun aktiv SMS kod topilmadi")

    if row.get("expires_at") and isinstance(row["expires_at"], datetime) and row["expires_at"] < now_value:
        raise HTTPException(status_code=400, detail="SMS kod muddati tugagan")

    if str(row.get("code") or "") != normalized_code:
        db.execute(text("UPDATE phone_otp_auth SET attempts = COALESCE(attempts, 0) + 1 WHERE id = :id"), {"id": row["id"]})
        db.commit()
        raise HTTPException(status_code=400, detail="SMS kodi noto'g'ri")

    db.execute(text("UPDATE phone_otp_auth SET is_used = TRUE, used_at = :used_at WHERE id = :id"), {"used_at": now_value, "id": row["id"]})
    db.commit()

    entity_type, entity = find_identity_by_phone(db, normalized_phone)
    if entity is None:
        entity = create_phone_student_account(db, (name or row.get("name") or "").strip(), normalized_phone)
        entity_type = "student"

    if entity_type == "admin":
        return build_login_response(entity.id, getattr(entity, "role", "admin"), entity.name, entity.email, entity.avatar, getattr(entity, "phone", None))

    if entity_type == "barber":
        seed_barber_appointments_if_empty(db, entity)
        return build_login_response(entity.id, getattr(entity, "role", "barber"), entity.name, entity.username or "", entity.photo_url, entity.phone)

    return build_login_response(entity.id, getattr(entity, "role", "student"), entity.name, entity.email, entity.avatar, entity.phone)


def get_telegram_bot_token() -> str:
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def get_telegram_bot_username() -> str:
    global telegram_bot_username_cache

    configured = os.getenv("TELEGRAM_BOT_USERNAME", "").strip().lstrip("@")
    if configured:
        telegram_bot_username_cache = configured
        return configured

    if telegram_bot_username_cache:
        return telegram_bot_username_cache

    token = get_telegram_bot_token()
    if not token:
        return ""

    url = f"https://api.telegram.org/bot{token}/getMe"
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            if not (200 <= response.status < 300):
                return ""
            payload = json.loads(response.read().decode("utf-8"))
            username = str(payload.get("result", {}).get("username", "")).strip().lstrip("@")
            if username:
                telegram_bot_username_cache = username
                return username
    except Exception as exc:
        print(f"[WARNING] Telegram bot username resolve failed: {exc}")

    return ""


def build_telegram_deep_link(start_token: str) -> str:
    bot_username = get_telegram_bot_username()
    if not bot_username:
        return ""
    return f"https://t.me/{bot_username}?start={urllib.parse.quote(start_token)}"


def send_telegram_message(chat_id: Optional[str], text_message: str, reply_markup: Optional[dict] = None) -> bool:
    token = get_telegram_bot_token()
    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload_obj = {"chat_id": str(chat_id), "text": text_message}
    if reply_markup is not None:
        payload_obj["reply_markup"] = reply_markup

    payload = json.dumps(payload_obj).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return 200 <= response.status < 300
    except Exception as exc:
        print(f"[WARNING] Telegram send failed: {exc}")
        return False


def send_telegram_to_student(student: Optional[models.Student], text_message: str) -> bool:
    if not student:
        return False

    chat_id = getattr(student, "telegram_chat_id", None) or None
    if not chat_id and student.telegram:
        tg_value = str(student.telegram).strip()
        if tg_value.lstrip("-").isdigit():
            chat_id = tg_value

    return send_telegram_message(chat_id, text_message)


def format_uzs_amount(amount: Optional[float]) -> str:
    try:
        value = float(amount or 0)
    except Exception:
        value = 0.0

    if value.is_integer():
        amount_text = f"{int(value):,}".replace(",", " ")
    else:
        amount_text = f"{value:,.2f}".replace(",", " ").replace(".", ",")

    return f"{amount_text} so'm"


def format_attendance_status(status: Optional[str]) -> str:
    normalized = (status or "").strip().lower()
    status_map = {
        "present": "✅ Keldi",
        "late": "🕒 Kechikdi",
        "absent": "❌ Kelmadi",
    }
    return status_map.get(normalized, status or "Noma'lum")


TELEGRAM_BTN_ATTENDANCE = "Davomat"
TELEGRAM_BTN_PAYMENTS = "To'lovlar"
TELEGRAM_BTN_GRADES = "Baholar"
TELEGRAM_BTN_COURSES = "Kurslarim"
TELEGRAM_BTN_HOMEWORK = "Homework"


def telegram_student_menu_keyboard() -> dict:
    return {
        "keyboard": [
            [{"text": TELEGRAM_BTN_ATTENDANCE}, {"text": TELEGRAM_BTN_PAYMENTS}],
            [{"text": TELEGRAM_BTN_GRADES}, {"text": TELEGRAM_BTN_COURSES}],
            [{"text": TELEGRAM_BTN_HOMEWORK}],
        ],
        "resize_keyboard": True,
    }


def get_student_by_chat_id(db: Session, chat_id: str) -> Optional[models.Student]:
    if not chat_id:
        return None
    return db.query(models.Student).filter(models.Student.telegram_chat_id == str(chat_id)).first()


def build_attendance_summary(db: Session, student: models.Student) -> str:
    rows = (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == student.id)
        .order_by(models.Attendance.date.desc(), models.Attendance.id.desc())
        .limit(5)
        .all()
    )
    if not rows:
        return "Davomat ma'lumotlari topilmadi."

    course_ids = {row.course_id for row in rows if row.course_id is not None}
    course_map = {
        item.id: item.name
        for item in db.query(models.Course).filter(models.Course.id.in_(list(course_ids))).all()
    } if course_ids else {}

    status_map = {"present": "Keldi", "late": "Kechikdi", "absent": "Kelmadi"}
    lines = [f"Davomat (oxirgi {len(rows)} ta):"]
    for row in rows:
        course_name = course_map.get(row.course_id, f"Kurs #{row.course_id}")
        status_text = status_map.get((row.status or "").lower(), row.status or "Noma'lum")
        grade_text = f", Baho: {row.grade}" if row.grade is not None else ""
        lines.append(f"- {row.date} | {course_name} | {status_text}{grade_text}")
    return "\n".join(lines)


def build_payment_summary(db: Session, student: models.Student) -> str:
    rows = (
        db.query(models.Payment)
        .filter(models.Payment.student_id == student.id)
        .order_by(models.Payment.updated_at.desc(), models.Payment.id.desc())
        .limit(5)
        .all()
    )
    if not rows:
        return "To'lov ma'lumotlari topilmadi."

    course_ids = {row.course_id for row in rows if row.course_id is not None}
    course_map = {
        item.id: item.name
        for item in db.query(models.Course).filter(models.Course.id.in_(list(course_ids))).all()
    } if course_ids else {}

    lines = [f"To'lovlar (oxirgi {len(rows)} ta):"]
    for row in rows:
        course_name = course_map.get(row.course_id, f"Kurs #{row.course_id}")
        status_text = "To'langan" if (row.status or "").lower() == "paid" else "Kutilmoqda"
        lines.append(f"- {course_name} | {format_uzs_amount(row.amount)} | {status_text} | Oy: {row.month}")
    return "\n".join(lines)


def build_grade_summary(db: Session, student: models.Student) -> str:
    rows = (
        db.query(models.Performance)
        .filter(models.Performance.student_id == student.id)
        .order_by(models.Performance.date.desc(), models.Performance.id.desc())
        .limit(5)
        .all()
    )
    if not rows:
        return "Baholar ma'lumotlari topilmadi."

    course_ids = {row.course_id for row in rows if row.course_id is not None}
    course_map = {
        item.id: item.name
        for item in db.query(models.Course).filter(models.Course.id.in_(list(course_ids))).all()
    } if course_ids else {}

    lines = [f"Baholar (oxirgi {len(rows)} ta):"]
    for row in rows:
        course_name = course_map.get(row.course_id, f"Kurs #{row.course_id}")
        lines.append(f"- {row.date} | {course_name} | {row.label}: {row.score}")
    return "\n".join(lines)


def build_courses_summary(db: Session, student: models.Student) -> str:
    enrollments = db.query(models.CourseEnrollment).filter(models.CourseEnrollment.student_id == student.id).all()
    if not enrollments:
        return "Siz hali birorta kursga biriktirilmagansiz."

    course_ids = [item.course_id for item in enrollments if item.course_id is not None]
    courses = db.query(models.Course).filter(models.Course.id.in_(course_ids)).all() if course_ids else []
    if not courses:
        return "Kurslar ma'lumotlari topilmadi."

    lines = [f"Kurslarim ({len(courses)} ta):"]
    for course in courses:
        lines.append(f"- {course.name} | Narx: {course.price} | Daraja: {course.level}")
    return "\n".join(lines)


def build_homework_summary(db: Session, student: models.Student) -> str:
    enrollments = db.query(models.CourseEnrollment).filter(models.CourseEnrollment.student_id == student.id).all()
    course_ids = [item.course_id for item in enrollments if item.course_id is not None]

    assignment_query = db.query(models.Assignment).filter(
        or_(
            models.Assignment.student_id == student.id,
            and_(models.Assignment.student_id.is_(None), models.Assignment.course_id.in_(course_ids) if course_ids else False),
        )
    )
    assignments = assignment_query.order_by(models.Assignment.created_at.desc(), models.Assignment.id.desc()).limit(7).all()

    if not assignments:
        return "Homework topilmadi."

    assignment_ids = [item.id for item in assignments]
    progress_rows = db.query(models.AssignmentProgress).filter(
        models.AssignmentProgress.assignment_id.in_(assignment_ids),
        models.AssignmentProgress.student_id == student.id,
    ).all()
    progress_map = {item.assignment_id: item.status for item in progress_rows}

    course_ids = {item.course_id for item in assignments if item.course_id is not None}
    course_map = {
        item.id: item.name
        for item in db.query(models.Course).filter(models.Course.id.in_(list(course_ids))).all()
    } if course_ids else {}

    lines = [f"Homework (oxirgi {len(assignments)} ta):"]
    for assignment in assignments:
        course_name = course_map.get(assignment.course_id, f"Kurs #{assignment.course_id}")
        status_text = progress_map.get(assignment.id, "new")
        lines.append(f"- {course_name} | {assignment.title} | Holat: {status_text}")
    return "\n".join(lines)


TELEGRAM_MENU_BUTTONS = ["Davomat", "To'lovlar", "Baholar", "Kurslarim", "Homework"]


def telegram_main_menu_markup() -> dict:
    return {
        "keyboard": [
            [{"text": "Davomat"}, {"text": "To'lovlar"}],
            [{"text": "Baholar"}, {"text": "Kurslarim"}],
            [{"text": "Homework"}],
        ],
        "resize_keyboard": True,
        "one_time_keyboard": False,
    }


def find_student_by_chat_id(db: Session, chat_id: str) -> Optional[models.Student]:
    if not chat_id:
        return None
    return db.query(models.Student).filter(models.Student.telegram_chat_id == str(chat_id)).first()


def build_telegram_attendance_summary(db: Session, student: models.Student) -> str:
    rows = db.query(models.Attendance).filter(
        models.Attendance.student_id == student.id
    ).order_by(models.Attendance.id.desc()).limit(5).all()

    if not rows:
        return "Davomat ma'lumoti hozircha topilmadi."

    lines = ["📘 Davomat (oxirgi 5 ta):"]
    for row in rows:
        course = db.query(models.Course).filter(models.Course.id == row.course_id).first()
        course_name = course.name if course else f"Kurs #{row.course_id}"
        lesson = db.query(models.Lesson).filter(models.Lesson.id == row.lesson_id).first() if row.lesson_id else None
        topic_text = lesson.topic if lesson and lesson.topic else "Mavzu kiritilmagan"
        status_text = format_attendance_status(row.status)
        grade_text = f"\n🎯 Baho: {row.grade}" if row.grade is not None else ""
        penalty_text = f"\n⏱ Jarima: {row.penalty_hours} soat" if row.penalty_hours is not None else ""
        lines.append(
            "\n".join([
                "━━━━━━━━━━━━━━",
                f"📚 Kurs: {course_name}",
                f"📝 Mavzu: {topic_text}",
                f"📅 Dars sanasi: {row.date}",
                f"📌 Holat: {status_text}",
            ]) + f"{grade_text}{penalty_text}"
        )
    return "\n".join(lines)


def build_telegram_payments_summary(db: Session, student: models.Student) -> str:
    rows = db.query(models.Payment).filter(
        models.Payment.student_id == student.id
    ).order_by(models.Payment.id.desc()).limit(5).all()

    if not rows:
        return "To'lov ma'lumoti hozircha topilmadi."

    lines = ["To'lovlar bo'limi (oxirgi holatlar):"]
    for row in rows:
        course = db.query(models.Course).filter(models.Course.id == row.course_id).first()
        course_name = course.name if course else f"Kurs #{row.course_id}"
        status_text = "✅ To'langan" if (row.status or "").lower() == "paid" else "⏳ Kutilmoqda"
        lines.append(
            "\n".join([
                f"• Kurs: {course_name}",
                f"  Oy: {row.month}",
                f"  Summa: {format_uzs_amount(row.amount)}",
                f"  Holat: {status_text}",
            ])
        )
    return "\n".join(lines)


def build_telegram_grades_summary(db: Session, student: models.Student) -> str:
    rows = db.query(models.Performance).filter(
        models.Performance.student_id == student.id
    ).order_by(models.Performance.id.desc()).limit(5).all()

    if rows:
        lines = ["🎯 Baholar (oxirgi 5 ta):"]
        for row in rows:
            course = db.query(models.Course).filter(models.Course.id == row.course_id).first()
            course_name = course.name if course else f"Kurs #{row.course_id}"
            lines.append(
                "\n".join([
                    "━━━━━━━━━━━━━━",
                    f"📚 Kurs: {course_name}",
                    f"📅 Sana: {row.date}",
                    f"📌 Turi: {row.label}",
                    f"✅ Natija: {row.score}",
                ])
            )
        return "\n".join(lines)

    attendance_rows = db.query(models.Attendance).filter(
        models.Attendance.student_id == student.id,
        models.Attendance.grade.isnot(None)
    ).order_by(models.Attendance.id.desc()).limit(5).all()

    if not attendance_rows:
        return "Baho ma'lumoti hozircha topilmadi."

    lines = ["🎯 Baholar (davomatdan olingan):"]
    for row in attendance_rows:
        course = db.query(models.Course).filter(models.Course.id == row.course_id).first()
        course_name = course.name if course else f"Kurs #{row.course_id}"
        lesson = db.query(models.Lesson).filter(models.Lesson.id == row.lesson_id).first() if row.lesson_id else None
        topic_text = lesson.topic if lesson and lesson.topic else "Mavzu kiritilmagan"
        lines.append(
            "\n".join([
                "━━━━━━━━━━━━━━",
                f"📚 Kurs: {course_name}",
                f"📝 Mavzu: {topic_text}",
                f"📅 Sana: {row.date}",
                f"✅ Baho: {row.grade}",
            ])
        )
    return "\n".join(lines)


def build_telegram_courses_summary(db: Session, student: models.Student) -> str:
    enrollments = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.student_id == student.id
    ).all()

    if not enrollments:
        return "Siz hali kursga yozilmagansiz."

    lines = ["Kurslaringiz:"]
    for enrollment in enrollments:
        course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()
        if course:
            lines.append(f"- {course.name} ({course.level})")
    return "\n".join(lines)


def build_telegram_homework_summary(db: Session, student: models.Student) -> str:
    enrollment_rows = db.query(models.CourseEnrollment.course_id).filter(
        models.CourseEnrollment.student_id == student.id
    ).all()
    enrolled_course_ids = [row[0] for row in enrollment_rows if row[0] is not None]

    query = db.query(models.Assignment).filter(
        (models.Assignment.student_id == student.id) |
        (
            models.Assignment.student_id.is_(None) &
            models.Assignment.course_id.in_(enrolled_course_ids if enrolled_course_ids else [-1])
        )
    )
    rows = query.order_by(models.Assignment.id.desc()).limit(5).all()

    if not rows:
        return "Homework hozircha topilmadi."

    lines = ["So'nggi homeworklar:"]
    for row in rows:
        course = db.query(models.Course).filter(models.Course.id == row.course_id).first()
        course_name = course.name if course else f"Kurs #{row.course_id}"
        submitted_text = "topshirilgan" if row.submitted else "topshirilmagan"
        lines.append(f"- {course_name} | {row.title} | {submitted_text}")
    return "\n".join(lines)


def build_telegram_menu_response(db: Session, student: models.Student, menu_text: str) -> str:
    normalized = (menu_text or "").strip().lower()
    if normalized == "davomat":
        return build_telegram_attendance_summary(db, student)
    if normalized == "to'lovlar":
        return build_telegram_payments_summary(db, student)
    if normalized == "baholar":
        return build_telegram_grades_summary(db, student)
    if normalized == "kurslarim":
        return build_telegram_courses_summary(db, student)
    if normalized == "homework":
        return build_telegram_homework_summary(db, student)
    return ""


def push_payment_telegram_message(db: Session, payment: models.Payment, student: Optional[models.Student] = None):
    if student is None:
        student = db.query(models.Student).filter(models.Student.id == payment.student_id).first()
    if not student:
        return

    course = db.query(models.Course).filter(models.Course.id == payment.course_id).first()
    course_name = course.name if course else f"Kurs #{payment.course_id}"
    status_text = "✅ To'landi" if payment.status == "paid" else "⏳ Kutilmoqda"
    message = (
        f"💳 To'lov holati yangilandi\n"
        f"━━━━━━━━━━━━━━\n"
        f"📚 Kurs: {course_name}\n"
        f"📅 Oy: {payment.month}\n"
        f"💰 Summa: {format_uzs_amount(payment.amount)}\n"
        f"📌 Holat: {status_text}"
    )
    send_telegram_to_student(student, message)



def build_payme_checkout_url(payment_id: int, amount: float) -> str:
    merchant_id = os.getenv("PAYME_MERCHANT_ID", "").strip()
    checkout_base = os.getenv("PAYME_CHECKOUT_BASE", "https://checkout.paycom.uz")
    amount_tiyin = int(round(float(amount) * 100))

    if not merchant_id:
        return ""

    account = {
        "payment_id": str(payment_id),
    }
    account_json = json.dumps(account, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    account_encoded = base64.urlsafe_b64encode(account_json).decode("utf-8").rstrip("=")
    return f"{checkout_base}/?m={merchant_id}&ac={account_encoded}&a={amount_tiyin}"


def verify_payme_callback_signature(raw_body: bytes, signature: str) -> bool:
    secret = os.getenv("PAYME_CALLBACK_SECRET", "").strip()
    allow_unsafe = os.getenv("PAYME_ALLOW_UNSAFE_CALLBACK", "false").lower() == "true"
    if allow_unsafe and not secret:
        return True
    if not secret:
        return False
    if not signature:
        return False

    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def find_student_by_phone(db: Session, phone: str) -> Optional[models.Student]:
    normalized_target = normalize_phone(phone)
    if not normalized_target:
        return None

    students = db.query(models.Student).filter(models.Student.phone.isnot(None)).all()
    for student in students:
        if normalize_phone(student.phone) == normalized_target:
            return student

    return None


@app.post("/telegram/link/request", response_model=schemas.TelegramLinkResponse)
def request_telegram_link(payload: schemas.TelegramLinkRequest, db: Session = Depends(get_db)):
    student = find_student_by_phone(db, payload.phone)
    if not student:
        raise HTTPException(status_code=404, detail="Bu telefon raqamga bog'langan o'quvchi topilmadi")

    expires_at = datetime.utcnow() + timedelta(minutes=15)
    start_token = uuid.uuid4().hex

    db.query(models.TelegramLinkToken).filter(
        models.TelegramLinkToken.student_id == student.id,
        models.TelegramLinkToken.is_used.is_(False),
    ).update({"is_used": True, "used_at": datetime.utcnow()}, synchronize_session=False)

    sync_table_id_sequence(db, "telegram_link_token")
    db_token = models.TelegramLinkToken(
        student_id=student.id,
        phone=normalize_phone(payload.phone),
        token=start_token,
        is_used=False,
        expires_at=expires_at,
    )
    db.add(db_token)
    db.commit()

    deep_link = build_telegram_deep_link(start_token)
    if not deep_link:
        raise HTTPException(status_code=500, detail="Telegram deep-link yaratib bo'lmadi")

    return {
        "student_id": student.id,
        "student_name": student.name,
        "phone": student.phone or payload.phone,
        "deep_link": deep_link,
        "qr_payload": deep_link,
        "expires_at": expires_at,
    }


@app.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    message = payload.get("message") or {}
    text_message = (message.get("text") or "").strip()
    contact = message.get("contact") or {}
    from_user = message.get("from") or {}
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "").strip()

    if contact:
        pending_token = db.query(models.TelegramLinkToken).filter(
            models.TelegramLinkToken.chat_id == chat_id,
            models.TelegramLinkToken.is_used.is_(False),
        ).order_by(models.TelegramLinkToken.created_at.desc()).first()

        if not pending_token or pending_token.expires_at < datetime.utcnow():
            if pending_token and not pending_token.is_used:
                pending_token.is_used = True
                pending_token.used_at = datetime.utcnow()
                db.commit()
            send_telegram_message(
                chat_id,
                "Bog'lash tokeni topilmadi yoki eskirgan. Iltimos, ilovadan yangi Telegram havola oling.",
            )
            return {"ok": True}

        contact_user_id = contact.get("user_id")
        from_user_id = from_user.get("id")
        if contact_user_id is None or from_user_id is None or int(contact_user_id) != int(from_user_id):
            send_telegram_message(
                chat_id,
                "Faqat o'zingizning telefon kontaktingizni yuborishingiz kerak.",
            )
            return {"ok": True}

        contact_phone = normalize_phone(contact.get("phone_number"))
        token_phone = normalize_phone(pending_token.phone)
        if not contact_phone or not token_phone or contact_phone != token_phone:
            send_telegram_message(
                chat_id,
                "Telefon raqam mos kelmadi. Faqat o'zingizga tegishli raqam bilan bog'lashingiz mumkin.",
            )
            return {"ok": True}

        student = db.query(models.Student).filter(models.Student.id == pending_token.student_id).first()
        if not student:
            send_telegram_message(chat_id, "O'quvchi topilmadi.")
            return {"ok": True}

        student.telegram_chat_id = chat_id
        username = from_user.get("username")
        if username:
            student.telegram = f"@{username}"
        student.telegram_linked_at = datetime.utcnow()

        pending_token.is_used = True
        pending_token.used_at = datetime.utcnow()
        pending_token.chat_id = chat_id
        db.commit()

        send_telegram_message(
            chat_id,
            f"Assalomu alaykum, {student.name}!\nBot muvaffaqiyatli ulandi. Endi davomat, baho, o'zlashtirish va to'lov xabarlari shu yerga keladi.",
            reply_markup=telegram_main_menu_markup(),
        )

        return {"ok": True}

    if text_message and text_message in TELEGRAM_MENU_BUTTONS:
        student = find_student_by_chat_id(db, chat_id)
        if not student:
            send_telegram_message(chat_id, "Avval botni ilovadagi Telegram havola orqali ulang.")
            return {"ok": True}

        response_text = build_telegram_menu_response(db, student, text_message)
        if response_text:
            send_telegram_message(chat_id, response_text, reply_markup=telegram_main_menu_markup())
        return {"ok": True}

    if text_message == "/menu":
        send_telegram_message(chat_id, "Asosiy menyu:", reply_markup=telegram_main_menu_markup())
        return {"ok": True}

    if not text_message.startswith("/start"):
        return {"ok": True}

    parts = text_message.split(maxsplit=1)
    start_token = parts[1].strip() if len(parts) > 1 else ""

    if not start_token:
        student = find_student_by_chat_id(db, chat_id)
        if student:
            send_telegram_message(chat_id, "Asosiy menyu:", reply_markup=telegram_main_menu_markup())
        else:
            send_telegram_message(chat_id, "Avval ilovadan Telegram bog'lash havolasini oling.")
        return {"ok": True}

    if not chat_id:
        send_telegram_message(chat_id, "Bog'lash ma'lumoti topilmadi. Admin orqali qayta urinib ko'ring.")
        return {"ok": True}

    token_row = db.query(models.TelegramLinkToken).filter(
        models.TelegramLinkToken.token == start_token,
    ).first()

    if not token_row:
        send_telegram_message(chat_id, "Bog'lash havolasi noto'g'ri. Ilovadan qayta havola oling.")
        return {"ok": True}

    if token_row.is_used:
        return {"ok": True}

    if token_row.expires_at < datetime.utcnow():
        token_row.is_used = True
        token_row.used_at = datetime.utcnow()
        token_row.chat_id = chat_id
        db.commit()
        send_telegram_message(chat_id, "Token eskirgan. Iltimos, ilovadan yangi havola oling.")
        return {"ok": True}

    token_row.chat_id = chat_id
    db.commit()

    send_telegram_message(
        chat_id,
        "Bog'lashni yakunlash uchun pastdagi tugma orqali o'zingizning telefon raqamingizni yuboring.",
        reply_markup={
            "keyboard": [[{"text": "Telefon raqamni yuborish", "request_contact": True}]],
            "resize_keyboard": True,
            "one_time_keyboard": True,
        },
    )

    return {"ok": True}



@app.websocket("/ws/notifications/{user_id}")
async def notifications_ws(websocket: WebSocket, user_id: int):
    auth_payload = await authenticate_ws(websocket)
    if not auth_payload:
        return

    auth_role = str(auth_payload.get("role") or "").strip().lower()
    auth_user_id = to_int(auth_payload.get("user_id"))
    if auth_role != "admin" and auth_user_id != user_id:
        inc_metric("ws_auth_failed")
        await websocket.close(code=1008, reason="Forbidden")
        return

    if ws_total_connections() >= MAX_WS_TOTAL_CONNECTIONS:
        inc_metric("ws_rejected")
        await websocket.close(code=1013, reason="Server busy")
        return

    connected = await notification_manager.connect(user_id, websocket)
    if not connected:
        return

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(user_id, websocket)
    except Exception:
        notification_manager.disconnect(user_id, websocket)


@app.websocket("/ws/events/{channel}")
async def realtime_events_ws(websocket: WebSocket, channel: str):
    if channel == "public-map":
        if ws_total_connections() >= MAX_WS_TOTAL_CONNECTIONS:
            inc_metric("ws_rejected")
            await websocket.close(code=1013, reason="Server busy")
            return

        connected = await realtime_manager.connect(channel, websocket)
        if not connected:
            return

        try:
            while True:
                msg = await websocket.receive_text()
                if msg == "ping":
                    try:
                        await websocket.send_text("pong")
                    except Exception:
                        pass
        except WebSocketDisconnect:
            realtime_manager.disconnect(channel, websocket)
        except Exception:
            realtime_manager.disconnect(channel, websocket)
        return

    auth_payload = await authenticate_ws(websocket)
    if not auth_payload:
        return

    if not can_subscribe_channel(channel, auth_payload):
        inc_metric("ws_auth_failed")
        await websocket.close(code=1008, reason="Forbidden channel")
        return

    if ws_total_connections() >= MAX_WS_TOTAL_CONNECTIONS:
        inc_metric("ws_rejected")
        await websocket.close(code=1013, reason="Server busy")
        return

    connected = await realtime_manager.connect(channel, websocket)
    if not connected:
        return

    try:
        while True:
            msg = await websocket.receive_text()
            # Handle ping-pong for keep-alive and latency monitoring
            if msg == "ping":
                try:
                    await websocket.send_text("pong")
                except Exception:
                    pass
    except WebSocketDisconnect:
        realtime_manager.disconnect(channel, websocket)
    except Exception:
        realtime_manager.disconnect(channel, websocket)

# Initialize test data on startup
# Data already initialized via init_db.py
# This is commented out to avoid startup crashes


def ensure_legacy_schema_compatibility():
    """Add missing columns for legacy databases so endpoints do not crash."""
    statements = [
        """
        CREATE TABLE IF NOT EXISTS admin (
            id SERIAL PRIMARY KEY,
            email VARCHAR UNIQUE,
            password VARCHAR,
            name VARCHAR,
            phone VARCHAR NULL,
            avatar VARCHAR NULL,
            role VARCHAR DEFAULT 'admin'
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS teacher (
            id SERIAL PRIMARY KEY,
            name VARCHAR,
            email VARCHAR UNIQUE,
            password VARCHAR,
            avatar VARCHAR NULL,
            subject VARCHAR NULL,
            role VARCHAR DEFAULT 'teacher'
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS student (
            id SERIAL PRIMARY KEY,
            name VARCHAR,
            email VARCHAR UNIQUE,
            password VARCHAR,
            avatar VARCHAR NULL,
            phone VARCHAR NULL,
            telegram VARCHAR NULL,
            role VARCHAR DEFAULT 'student',
            telegram_chat_id VARCHAR NULL,
            telegram_linked_at TIMESTAMP NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS barber (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            specialty VARCHAR NOT NULL,
            phone VARCHAR NOT NULL,
            rating FLOAT DEFAULT 4.8,
            rating_votes INTEGER DEFAULT 0,
            total_cuts INTEGER DEFAULT 0,
            today_cuts INTEGER DEFAULT 0,
            status VARCHAR DEFAULT 'available',
            color VARCHAR DEFAULT '#818cf8',
            gradient VARCHAR DEFAULT 'linear-gradient(135deg,#6366f1,#818cf8)',
            photo_url VARCHAR NULL,
            years_experience INTEGER DEFAULT 1,
            username VARCHAR NULL,
            password VARCHAR NULL,
            role VARCHAR DEFAULT 'barber',
            bio VARCHAR NULL,
            work_directions VARCHAR NULL,
            service_price FLOAT DEFAULT 40000,
            discount_percent FLOAT DEFAULT 0,
            location_address VARCHAR NULL,
            location_latitude FLOAT NULL,
            location_longitude FLOAT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS barbershop (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            address VARCHAR NOT NULL,
            latitude FLOAT NOT NULL,
            longitude FLOAT NOT NULL,
            photo_url VARCHAR NULL,
            description VARCHAR NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS lesson (
            id SERIAL PRIMARY KEY,
            course_id INTEGER NOT NULL,
            topic VARCHAR NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            attendance_saved BOOLEAN DEFAULT FALSE,
            attendance_edit_used BOOLEAN DEFAULT FALSE
        )
        """,
        "ALTER TABLE IF EXISTS payment ADD COLUMN IF NOT EXISTS payment_method VARCHAR",
        "ALTER TABLE IF EXISTS payment ADD COLUMN IF NOT EXISTS payment_details JSON",
        "ALTER TABLE IF EXISTS payment ADD COLUMN IF NOT EXISTS created_at TIMESTAMP",
        "ALTER TABLE IF EXISTS payment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS lesson_id INTEGER",
        "ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS penalty_hours INTEGER",
        "ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS grade FLOAT",
        "ALTER TABLE IF EXISTS assignment ADD COLUMN IF NOT EXISTS submitted BOOLEAN DEFAULT FALSE",
        "ALTER TABLE IF EXISTS assignment ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP",
        "ALTER TABLE IF EXISTS assignment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE IF EXISTS notification ADD COLUMN IF NOT EXISTS assignment_id INTEGER",
        "ALTER TABLE IF EXISTS assignment_progress ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'accepted'",
        "ALTER TABLE IF EXISTS assignment_progress ADD COLUMN IF NOT EXISTS seen_at TIMESTAMP",
        "ALTER TABLE IF EXISTS assignment_progress ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP",
        "ALTER TABLE IF EXISTS assignment_progress ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMP",
        "ALTER TABLE IF EXISTS assignment_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP",
        "ALTER TABLE IF EXISTS assignment_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE IF EXISTS student ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR",
        "ALTER TABLE IF EXISTS student ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMP",
        "ALTER TABLE IF EXISTS admin ADD COLUMN IF NOT EXISTS avatar VARCHAR",
        "ALTER TABLE IF EXISTS admin ADD COLUMN IF NOT EXISTS phone VARCHAR",
        "ALTER TABLE IF EXISTS admin ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'admin'",
        "ALTER TABLE IF EXISTS teacher ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'teacher'",
        "ALTER TABLE IF EXISTS student ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'student'",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'barber'",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS work_directions VARCHAR",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS service_price FLOAT DEFAULT 40000",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS discount_percent FLOAT DEFAULT 0",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS barbershop_id INTEGER NULL",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS location_address VARCHAR",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS location_latitude FLOAT",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS location_longitude FLOAT",
        "ALTER TABLE IF EXISTS barber ADD COLUMN IF NOT EXISTS rating_votes INTEGER DEFAULT 0",
        "UPDATE admin SET role = 'admin' WHERE role IS NULL OR role = ''",
        "UPDATE teacher SET role = 'teacher' WHERE role IS NULL OR role = ''",
        "UPDATE student SET role = 'student' WHERE role IS NULL OR role = ''",
        "UPDATE barber SET role = 'barber' WHERE role IS NULL OR role = ''",
        """
        CREATE TABLE IF NOT EXISTS telegram_link_token (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES student(id),
            phone VARCHAR NOT NULL,
            token VARCHAR NOT NULL UNIQUE,
            is_used BOOLEAN DEFAULT FALSE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            chat_id VARCHAR NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS barber_appointment (
            id SERIAL PRIMARY KEY,
            barber_id INTEGER NOT NULL REFERENCES barber(id) ON DELETE CASCADE,
            client_name VARCHAR NOT NULL,
            client_phone VARCHAR NOT NULL,
            appointment_time VARCHAR NOT NULL,
            appointment_date VARCHAR NOT NULL,
            status VARCHAR DEFAULT 'pending',
            service_name VARCHAR NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS phone_otp_auth (
            id SERIAL PRIMARY KEY,
            phone VARCHAR NOT NULL,
            code VARCHAR NOT NULL,
            name VARCHAR NULL,
            is_used BOOLEAN DEFAULT FALSE,
            attempts INTEGER DEFAULT 0,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
        """,
    ]

    try:
        with engine.begin() as conn:
            for statement in statements:
                conn.execute(text(statement))
    except SQLAlchemyError as exc:
        print(f"Schema compatibility migration warning: {exc}")


def sync_table_id_sequence_with_connection(conn, table_name: str):
    """Sync a table's id sequence to max(id)+1 using an open SQLAlchemy connection."""
    try:
        seq_name = conn.execute(
            text(f"SELECT pg_get_serial_sequence('{table_name}', 'id')")
        ).scalar()

        if not seq_name:
            return

        conn.execute(
            text(
                f"""
                SELECT setval(
                    CAST(:seq_name AS regclass),
                    COALESCE((SELECT MAX(id) FROM {table_name}), 0) + 1,
                    false
                )
                """
            ),
            {"seq_name": seq_name},
        )
    except SQLAlchemyError as exc:
        print(f"{table_name} sequence sync warning: {exc}")


def sync_table_id_sequence(db: Session, table_name: str):
    """Session-level id sequence sync for safe inserts."""
    try:
        seq_name = db.execute(
            text(f"SELECT pg_get_serial_sequence('{table_name}', 'id')")
        ).scalar()

        if not seq_name:
            return

        db.execute(
            text(
                f"""
                SELECT setval(
                    CAST(:seq_name AS regclass),
                    COALESCE((SELECT MAX(id) FROM {table_name}), 0) + 1,
                    false
                )
                """
            ),
            {"seq_name": seq_name},
        )
        db.flush()  # Flush but don't commit - let caller decide
    except Exception as exc:
        print(f"Warning: {table_name} sequence sync failed (non-critical): {exc}")
        pass  # Continue even if sync fails


def sync_critical_sequences_with_connection(conn):
    for table_name in ("notification", "attendance", "assignment_progress", "course_enrollment", "course", "student", "payment", "lesson", "telegram_link_token"):
        sync_table_id_sequence_with_connection(conn, table_name)


def sync_critical_sequences(db: Session):
    for table_name in ("notification", "attendance", "assignment_progress", "course_enrollment", "course", "student", "payment", "lesson", "telegram_link_token"):
        sync_table_id_sequence(db, table_name)


def sync_notification_id_sequence_with_connection(conn):
    """Sync notification.id sequence to current max(id) to avoid duplicate key errors."""
    sync_table_id_sequence_with_connection(conn, "notification")


def sync_notification_id_sequence(db: Session):
    """Session-level sequence sync for safety before notification inserts."""
    sync_table_id_sequence(db, "notification")


@app.on_event("startup")
async def startup_schema_compatibility():
    """Keep startup non-blocking so Render can detect an open port quickly."""
    global app_event_loop
    app_event_loop = asyncio.get_running_loop()
    start_redis_realtime_listener()
    ensure_legacy_schema_compatibility()
    try:
        models.Admin.__table__.create(bind=engine, checkfirst=True)
        models.Teacher.__table__.create(bind=engine, checkfirst=True)
        models.Student.__table__.create(bind=engine, checkfirst=True)
        models.Barbershop.__table__.create(bind=engine, checkfirst=True)
        models.Barber.__table__.create(bind=engine, checkfirst=True)
        models.BarberAppointment.__table__.create(bind=engine, checkfirst=True)
    except Exception as startup_error:
        print(f"Warning: auth/barber table init failed: {startup_error}")


@app.on_event("shutdown")
async def shutdown_realtime_infra():
    stop_redis_realtime_listener()


@app.get("/health/realtime")
def realtime_health_snapshot():
    with metrics_lock:
        snapshot = dict(REALTIME_METRICS)

    snapshot.update(
        {
            "instance_id": INSTANCE_ID,
            "channels": len(realtime_manager.channels),
            "total_ws_connections": ws_total_connections(),
            "redis_enabled": redis_client is not None,
        }
    )
    return snapshot


def seed_barber_appointments_if_empty(db: Session, barber: models.Barber):
    today = today_tashkent_str()
    existing = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.barber_id == barber.id,
        models.BarberAppointment.appointment_date == today,
    ).count()

    if existing > 0:
        return

    seeds = [
        models.BarberAppointment(
            barber_id=barber.id,
            client_name="Carlos Mendez",
            client_phone="555-0201",
            appointment_time="9:30 AM",
            appointment_date=today,
            status="completed",
            service_name="Classic Cut",
        ),
        models.BarberAppointment(
            barber_id=barber.id,
            client_name="Raj Patel",
            client_phone="555-0202",
            appointment_time="11:00 AM",
            appointment_date=today,
            status="completed",
            service_name="Beard Trim",
        ),
        models.BarberAppointment(
            barber_id=barber.id,
            client_name="Sam Torres",
            client_phone="555-0203",
            appointment_time="2:00 PM",
            appointment_date=today,
            status="pending",
            service_name="Fade + Styling",
        ),
    ]
    for item in seeds:
        db.add(item)
    db.commit()


BARBER_TIME_SLOTS = [
    "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
    "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
]


def format_booking_code(appointment_id: int) -> str:
    return f"#BK{str(appointment_id).zfill(4)}"


def normalize_status_for_admin(status_value: Optional[str]) -> str:
    normalized = (status_value or "pending").strip().lower()
    if normalized in {"pending", "completed", "cancelled"}:
        return normalized
    return "pending"


def estimate_service_price(service_name: Optional[str]) -> float:
    service_text = (service_name or "").strip().lower()
    if "beard" in service_text:
        return 25000
    if "fade" in service_text:
        return 45000
    if "style" in service_text:
        return 50000
    if "classic" in service_text:
        return 30000
    return 40000


def clamp_discount_percent(discount_value: Optional[float]) -> float:
    try:
        parsed = float(discount_value or 0)
    except Exception:
        parsed = 0
    return max(0.0, min(100.0, parsed))


def get_barber_service_price(barber: Optional[models.Barber], service_name: Optional[str] = None) -> float:
    if barber is not None and barber.service_price and barber.service_price > 0:
        return float(barber.service_price)
    return estimate_service_price(service_name or (barber.specialty if barber else None))


def get_discounted_price(base_price: float, discount_percent: Optional[float]) -> float:
    normalized_discount = clamp_discount_percent(discount_percent)
    discounted = base_price * (1 - normalized_discount / 100)
    return round(max(0, discounted), 2)


ALLOWED_ASSIGNMENT_STATUSES = {"accepted", "in_progress", "completed"}
ALLOWED_ATTENDANCE_HOURS = {0, 2, 4}


def attendance_status_from_penalty_hours(penalty_hours: int) -> str:
    if penalty_hours == 0:
        return "present"
    if penalty_hours == 2:
        return "late"
    return "absent"


def create_teacher_status_notification(
    db: Session,
    teacher_id: int,
    assignment_id: int,
    assignment_title: str,
    student_name: str,
    status_value: str,
):
    status_title_map = {
        "accepted": "Vazifa qabul qilindi",
        "in_progress": "Vazifa bajarilmoqda",
        "completed": "Vazifa tugatildi",
    }

    status_message_map = {
        "accepted": f"{student_name} vazifani qabul qildi: {assignment_title}",
        "in_progress": f"{student_name} vazifani bajarish jarayonida: {assignment_title}",
        "completed": f"{student_name} vazifani tugatdi: {assignment_title}",
    }

    db.add(models.Notification(
        user_id=teacher_id,
        title=status_title_map.get(status_value, "Vazifa holati yangilandi"),
        message=status_message_map.get(status_value, f"{student_name}: {assignment_title}"),
        type=f"assignment_status_{status_value}",
        assignment_id=assignment_id,
    ))





def get_password_policy_error(password_value: str) -> Optional[str]:
    candidate = password_value or ""
    if len(candidate) < 8:
        return "Parol kamida 8 ta belgidan iborat bo'lishi kerak"
    if not any(ch.islower() for ch in candidate):
        return "Parolda kamida 1 ta kichik harf bo'lishi kerak"
    if not any(ch.isupper() for ch in candidate):
        return "Parolda kamida 1 ta katta harf bo'lishi kerak"
    if not any(ch.isdigit() for ch in candidate):
        return "Parolda kamida 1 ta raqam bo'lishi kerak"
    special_chars = "!@#$%^&*()-_=+[]{};:,.?/\\|`~"
    if not any(ch in special_chars for ch in candidate):
        return "Parolda kamida 1 ta maxsus belgi bo'lishi kerak"
    return None

@app.get("/")
def read_root(): return {"message": "Welcome to EduGrow Platform API"}

# ========== AUTHENTICATION ENDPOINTS ==========


@app.post("/auth/register", response_model=schemas.LoginResponse)
def register_user(payload: schemas.RegisterUserRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email majburiy")

    normalized_name = payload.name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Ism majburiy")

    password_error = get_password_policy_error(payload.password.strip())
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    existing_student = db.query(models.Student).filter(func.lower(models.Student.email) == normalized_email).first()
    existing_admin = db.query(models.Admin).filter(func.lower(models.Admin.email) == normalized_email).first()
    existing_teacher = db.query(models.Teacher).filter(func.lower(models.Teacher.email) == normalized_email).first()
    existing_barber = db.query(models.Barber).filter(func.lower(models.Barber.username) == normalized_email).first()
    if existing_student or existing_admin or existing_teacher or existing_barber:
        raise HTTPException(status_code=400, detail="Bu email allaqachon ro'yxatdan o'tgan")

    db_student = models.Student(
        name=normalized_name,
        email=normalized_email,
        password=hash_password(payload.password.strip()),
        role="student",
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return build_login_response(db_student.id, "student", db_student.name, db_student.email, db_student.avatar, db_student.phone)

@app.post("/auth/login", response_model=schemas.LoginResponse)
def login(login_payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Login for admin, teacher or student"""
    normalized_email = login_payload.email.strip().lower()
    normalized_password = login_payload.password.strip()

    # Check admin
    db_admin = None
    try:
        db_admin = db.query(models.Admin).filter(func.lower(models.Admin.email) == normalized_email).first()
    except SQLAlchemyError:
        db_admin = None

    if db_admin and verify_password(normalized_password, db_admin.password):
        admin_role = (db_admin.role or "admin").strip().lower()
        return build_login_response(db_admin.id, admin_role, db_admin.name, db_admin.email, db_admin.avatar, getattr(db_admin, "phone", None))
    
    # Check teacher (handle legacy duplicate-case emails safely)
    db_teachers = []
    try:
        db_teachers = db.query(models.Teacher).filter(func.lower(models.Teacher.email) == normalized_email).all()
    except SQLAlchemyError:
        db_teachers = []

    for db_teacher in db_teachers:
        teacher_password_valid = False
        try:
            teacher_password_valid = verify_password(normalized_password, db_teacher.password)
        except Exception:
            teacher_password_valid = False

        if not teacher_password_valid and db_teacher.password == normalized_password:
            db_teacher.password = hash_password(normalized_password)
            db.commit()
            db.refresh(db_teacher)
            teacher_password_valid = True

        if teacher_password_valid:
            teacher_role = (db_teacher.role or "teacher").strip().lower()
            return build_login_response(db_teacher.id, teacher_role, db_teacher.name, db_teacher.email, db_teacher.avatar)
    
    # Check student
    db_student = None
    try:
        db_student = db.query(models.Student).filter(func.lower(models.Student.email) == normalized_email).first()
    except SQLAlchemyError:
        db_student = None

    if db_student and verify_password(normalized_password, db_student.password):
        student_role = (db_student.role or "student").strip().lower()
        return build_login_response(db_student.id, student_role, db_student.name, db_student.email, db_student.avatar, db_student.phone)

    db_barber = db.query(models.Barber).filter(func.lower(models.Barber.username) == normalized_email).first()
    if db_barber:
        barber_password_valid = False
        if db_barber.password:
            try:
                barber_password_valid = verify_password(normalized_password, db_barber.password)
            except Exception:
                barber_password_valid = False

            if not barber_password_valid and db_barber.password == normalized_password:
                db_barber.password = hash_password(normalized_password)
                db.commit()
                db.refresh(db_barber)
                barber_password_valid = True

        if barber_password_valid:
            seed_barber_appointments_if_empty(db, db_barber)
            barber_role = (db_barber.role or "barber").strip().lower()
            return build_login_response(db_barber.id, barber_role, db_barber.name, db_barber.username or "", db_barber.photo_url, db_barber.phone)
    
    raise HTTPException(status_code=401, detail="Email yoki parol noto'g'ri")


@app.post("/auth/phone/request", response_model=schemas.PhoneOtpSendResponse)
def request_phone_auth(payload: schemas.PhoneOtpRequest, db: Session = Depends(get_db)):
    return save_phone_otp_request(db, payload.phone, payload.name)


@app.post("/auth/phone/verify", response_model=schemas.LoginResponse)
def verify_phone_auth(payload: schemas.PhoneOtpVerifyRequest, db: Session = Depends(get_db)):
    return verify_phone_otp_and_login(db, payload.phone, payload.code, payload.name)

@app.post("/auth/verify")
def verify_token(authorization: Optional[str] = Header(None)):
    """Verify and decode JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

# ========== ADMIN MANAGEMENT ==========

@app.get("/admins/", response_model=List[schemas.Admin])
def read_admins(db: Session = Depends(get_db)): 
    return db.query(models.Admin).all()

@app.post("/admins/", response_model=schemas.Admin)
def create_admin(admin: schemas.AdminCreate, db: Session = Depends(get_db)):
    hashed_password = hash_password(admin.password)
    db_admin = models.Admin(
        email=admin.email,
        password=hashed_password,
        name=admin.name,
        phone=normalize_phone(admin.phone),
        avatar=admin.avatar,
        role="admin",
    )
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)
    return db_admin


@app.put("/admins/{admin_id}", response_model=schemas.Admin)
def update_admin(admin_id: int, admin: schemas.AdminUpdate, db: Session = Depends(get_db)):
    db_admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if db_admin is None:
        raise HTTPException(status_code=404, detail="Admin topilmadi")

    normalized_email = admin.email.strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email majburiy")

    normalized_name = admin.name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Ism majburiy")

    existing_admin = db.query(models.Admin).filter(
        func.lower(models.Admin.email) == normalized_email,
        models.Admin.id != admin_id,
    ).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Bu email allaqachon mavjud")

    db_admin.email = normalized_email
    db_admin.name = normalized_name
    db_admin.phone = normalize_phone(admin.phone)
    db_admin.avatar = (admin.avatar or "").strip() or None

    new_password = (admin.password or "").strip()
    if new_password:
        password_error = get_password_policy_error(new_password)
        if password_error:
            raise HTTPException(status_code=400, detail=password_error)
        db_admin.password = hash_password(new_password)

    db.commit()
    db.refresh(db_admin)
    return db_admin


@app.get("/admins/{admin_id}", response_model=schemas.Admin)
def get_admin_profile(admin_id: int, db: Session = Depends(get_db)):
    db_admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if db_admin is None:
        raise HTTPException(status_code=404, detail="Admin topilmadi")
    return db_admin

# Courses
@app.post("/courses/", response_model=schemas.Course)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    if not course.teacher_id:
        raise HTTPException(status_code=400, detail="teacher_id is required")

    teacher = db.query(models.Teacher).filter(models.Teacher.id == course.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    db_course = models.Course(**course.model_dump())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    invalidate_reference_caches()

    emit_role_events("admin", "course.created", {"course_id": db_course.id, "name": db_course.name})
    emit_role_events("teacher", "course.created", {"course_id": db_course.id, "name": db_course.name}, user_id=db_course.teacher_id)
    return db_course

@app.get("/courses/", response_model=List[schemas.Course])
def read_courses(skip: int = 0, limit: int = 100, teacher_id: Optional[int] = None, db: Session = Depends(get_db)):
    cache_key = f"courses:{teacher_id or 'all'}:{skip}:{limit}"
    cached = cache_get_json(cache_key)
    if cached is not None:
        return cached

    query = db.query(models.Course)
    if teacher_id:
        query = query.filter(models.Course.teacher_id == teacher_id)
    result = query.offset(skip).limit(limit).all()
    payload = [schemas.Course.model_validate(item).model_dump(mode="json") for item in result]
    cache_set_json(cache_key, payload)
    return payload

@app.put("/courses/{course_id}", response_model=schemas.Course)
def update_course(course_id: int, course: schemas.CourseCreate, db: Session = Depends(get_db)):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if db_course is None: raise HTTPException(status_code=404)
    for key, value in course.model_dump().items(): setattr(db_course, key, value)
    db.commit()
    db.refresh(db_course)
    invalidate_reference_caches()

    emit_role_events("admin", "course.updated", {"course_id": db_course.id, "name": db_course.name})
    emit_role_events("teacher", "course.updated", {"course_id": db_course.id, "name": db_course.name}, user_id=db_course.teacher_id)
    return db_course

@app.delete("/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db)):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if db_course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    deleted_payload = {"course_id": db_course.id, "name": db_course.name, "teacher_id": db_course.teacher_id}

    try:
        assignment_ids = [item[0] for item in db.query(models.Assignment.id).filter(models.Assignment.course_id == course_id).all()]

        if assignment_ids:
            db.query(models.Notification).filter(models.Notification.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
            db.query(models.AssignmentProgress).filter(models.AssignmentProgress.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)

        db.query(models.AssignmentProgress).filter(models.AssignmentProgress.course_id == course_id).delete(synchronize_session=False)
        db.query(models.Assignment).filter(models.Assignment.course_id == course_id).delete(synchronize_session=False)
        db.query(models.Payment).filter(models.Payment.course_id == course_id).delete(synchronize_session=False)
        db.query(models.CourseEnrollment).filter(models.CourseEnrollment.course_id == course_id).delete(synchronize_session=False)
        db.query(models.Attendance).filter(models.Attendance.course_id == course_id).delete(synchronize_session=False)
        db.query(models.Lesson).filter(models.Lesson.course_id == course_id).delete(synchronize_session=False)
        db.query(models.Performance).filter(models.Performance.course_id == course_id).delete(synchronize_session=False)

        db.delete(db_course)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Course cannot be deleted: {str(exc.orig)}")
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Course deletion failed: {str(exc)}")

    invalidate_reference_caches()
    emit_role_events("admin", "course.deleted", deleted_payload)
    if deleted_payload.get("teacher_id"):
        emit_role_events("teacher", "course.deleted", deleted_payload, user_id=deleted_payload["teacher_id"])
    return {"message": "deleted"}

# Course Enrollments
@app.post("/enrollments/")
async def create_enrollment(enrollment: schemas.CourseEnrollmentCreate, db: Session = Depends(get_db)):
    try:
        sync_table_id_sequence(db, "course_enrollment")
        sync_table_id_sequence(db, "payment")

        existing = db.query(models.CourseEnrollment).filter(
            models.CourseEnrollment.student_id == enrollment.student_id,
            models.CourseEnrollment.course_id == enrollment.course_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Student already enrolled in this course")
        
        db_enrollment = models.CourseEnrollment(**enrollment.model_dump())
        db.add(db_enrollment)
        db.flush()

        now = datetime.utcnow()
        current_month = now.strftime("%B")
        last_day = calendar.monthrange(now.year, now.month)[1]
        due_date = now.replace(day=last_day).strftime("%Y-%m-%d")

        existing_payment = db.query(models.Payment).filter(
            models.Payment.student_id == enrollment.student_id,
            models.Payment.course_id == enrollment.course_id,
            models.Payment.month == current_month,
        ).first()

        course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()

        if not existing_payment:
            db.add(models.Payment(
                student_id=enrollment.student_id,
                course_id=enrollment.course_id,
                amount=course.price if course else 0,
                currency="UZS",
                status="pending",
                due_date=due_date,
                month=current_month,
            ))

        student = db.query(models.Student).filter(models.Student.id == enrollment.student_id).first()
        course_name = course.name if course else f"Kurs #{enrollment.course_id}"
        student_name = student.name if student else f"Student #{enrollment.student_id}"
        notification_message = f"Siz {course_name} guruhiga qo'shildingiz. Admin: dars jadvali va vazifalarni tekshiring."

        sync_notification_id_sequence(db)
        db_notification = models.Notification(
            user_id=enrollment.student_id,
            title="📚 Guruhga qo'shildingiz",
            message=notification_message,
            type="enrollment_added",
        )
        db.add(db_notification)

        db.commit()
        invalidate_reference_caches()
        db.refresh(db_enrollment)
        db.refresh(db_notification)

        await notification_manager.broadcast_to_user(
            enrollment.student_id,
            notification_to_payload(db_notification),
        )

        event_payload = {
            "student_id": enrollment.student_id,
            "course_id": enrollment.course_id,
            "course_name": course_name,
            "notification_id": db_notification.id,
        }
        emit_role_events("admin", "enrollment.created", event_payload)
        emit_role_events("teacher", "enrollment.created", event_payload)
        emit_role_events("student", "enrollment.created", event_payload, user_id=enrollment.student_id)

        if not notification_manager.is_online(enrollment.student_id):
            send_sms_via_webhook(
                student.phone if student else None,
                f"{student_name}, {notification_message}",
            )

        return db_enrollment
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ERROR] create_enrollment failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Enrollment creation failed: {str(e)}")

@app.delete("/enrollments/{student_id}/{course_id}")
def delete_enrollment(student_id: int, course_id: int, db: Session = Depends(get_db)):
    enrollment = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.student_id == student_id,
        models.CourseEnrollment.course_id == course_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    db.delete(enrollment)
    db.commit()
    invalidate_reference_caches()
    return {"message": "Enrollment deleted"}

@app.get("/enrollments/counts")
def get_enrollment_counts(course_ids: Optional[str] = None, db: Session = Depends(get_db)):
    if not course_ids:
        return []

    ids: List[int] = []
    for raw_id in course_ids.split(","):
        raw_id = raw_id.strip()
        if not raw_id:
            continue
        try:
            ids.append(int(raw_id))
        except ValueError:
            continue

    if not ids:
        return []

    normalized_ids = ",".join(str(i) for i in ids)
    cache_key = f"enrollments:counts:{normalized_ids}"
    cached = cache_get_json(cache_key)
    if cached is not None:
        return cached

    rows = (
        db.query(
            models.CourseEnrollment.course_id,
            func.count(models.CourseEnrollment.id).label("count"),
        )
        .filter(models.CourseEnrollment.course_id.in_(ids))
        .group_by(models.CourseEnrollment.course_id)
        .all()
    )

    count_by_course = {int(row.course_id): int(row.count) for row in rows}
    payload = [{"course_id": course_id, "count": count_by_course.get(course_id, 0)} for course_id in ids]
    cache_set_json(cache_key, payload)
    return payload

@app.get("/enrollments/{course_id}")
def get_course_enrollments(course_id: int, db: Session = Depends(get_db)):
    cache_key = f"enrollments:course:{course_id}"
    cached = cache_get_json(cache_key)
    if cached is not None:
        return cached

    enrollments = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.course_id == course_id
    ).all()
    payload = [serialize_enrollment_row(item) for item in enrollments]
    cache_set_json(cache_key, payload)
    return payload


@app.get("/students/{student_id}/enrollments")
def get_student_enrollments_v2(student_id: int, db: Session = Depends(get_db)):
    cache_key = f"enrollments:student:{student_id}"
    cached = cache_get_json(cache_key)
    if cached is not None:
        return cached

    enrollments = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.student_id == student_id
    ).all()
    payload = [serialize_enrollment_row(item) for item in enrollments]
    cache_set_json(cache_key, payload)
    return payload


@app.get("/enrollments/student/{student_id}")
def get_student_enrollments(student_id: int, db: Session = Depends(get_db)):
    cache_key = f"enrollments:student:{student_id}"
    cached = cache_get_json(cache_key)
    if cached is not None:
        return cached

    enrollments = db.query(models.CourseEnrollment).filter(
        models.CourseEnrollment.student_id == student_id
    ).all()
    payload = [serialize_enrollment_row(item) for item in enrollments]
    cache_set_json(cache_key, payload)
    return payload

# Teachers
@app.get("/teachers/", response_model=List[schemas.Teacher])
def read_teachers(db: Session = Depends(get_db)):
    cache_key = "teachers:list"
    cached = cache_get_json(cache_key)
    if cached is not None:
        return cached

    rows = db.query(models.Teacher).all()
    payload = [schemas.Teacher.model_validate(item).model_dump(mode="json") for item in rows]
    cache_set_json(cache_key, payload)
    return payload

@app.post("/teachers/", response_model=schemas.Teacher)
def create_teacher(teacher: schemas.TeacherCreate, db: Session = Depends(get_db)):
    hashed_password = hash_password(teacher.password)
    db_teacher = models.Teacher(
        name=teacher.name,
        email=teacher.email,
        password=hashed_password,
        avatar=teacher.avatar,
        subject=teacher.subject,
        role="teacher",
    )
    db.add(db_teacher)
    db.commit()
    db.refresh(db_teacher)
    invalidate_reference_caches()

    emit_role_events("admin", "teacher.created", {"teacher_id": db_teacher.id, "name": db_teacher.name})
    emit_role_events("teacher", "teacher.created", {"teacher_id": db_teacher.id, "name": db_teacher.name}, user_id=db_teacher.id)

    return {
        "id": db_teacher.id,
        "name": db_teacher.name,
        "email": db_teacher.email,
        "avatar": db_teacher.avatar,
        "subject": db_teacher.subject
    }

@app.put("/teachers/{teacher_id}", response_model=schemas.Teacher)
def update_teacher(teacher_id: int, teacher: schemas.TeacherUpdate, db: Session = Depends(get_db)):
    db_teacher = db.query(models.Teacher).filter(models.Teacher.id == teacher_id).first()
    if db_teacher is None: raise HTTPException(status_code=404)

    normalized_email = teacher.email.strip().lower()
    current_email_normalized = (db_teacher.email or "").strip().lower()
    if normalized_email != current_email_normalized:
        existing = db.query(models.Teacher).filter(
            func.lower(models.Teacher.email) == normalized_email,
            models.Teacher.id != teacher_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Bu email allaqachon ro'yxatdan o'tgan")

    db_teacher.name = teacher.name
    db_teacher.email = normalized_email
    db_teacher.avatar = teacher.avatar
    db_teacher.subject = teacher.subject
    db_teacher.role = "teacher"

    incoming_password = teacher.password.strip() if teacher.password else None
    if incoming_password:
        db_teacher.password = hash_password(incoming_password)

    db.commit()
    db.refresh(db_teacher)
    invalidate_reference_caches()
    emit_role_events("admin", "teacher.updated", {"teacher_id": db_teacher.id, "name": db_teacher.name})
    emit_role_events("teacher", "teacher.updated", {"teacher_id": db_teacher.id, "name": db_teacher.name}, user_id=db_teacher.id)
    return {
        "id": db_teacher.id,
        "name": db_teacher.name,
        "email": db_teacher.email,
        "avatar": db_teacher.avatar,
        "subject": db_teacher.subject
    }

@app.delete("/teachers/{teacher_id}")
def delete_teacher(teacher_id: int, db: Session = Depends(get_db)):
    db_teacher = db.query(models.Teacher).filter(models.Teacher.id == teacher_id).first()
    if db_teacher is None: raise HTTPException(status_code=404)
    payload = {"teacher_id": db_teacher.id, "name": db_teacher.name}
    db.delete(db_teacher)
    db.commit()
    invalidate_reference_caches()
    emit_role_events("admin", "teacher.deleted", payload)
    emit_role_events("teacher", "teacher.deleted", payload, user_id=payload["teacher_id"])
    return {"message": "deleted"}


@app.get("/barbers/", response_model=List[schemas.Barber])
def read_barbers(db: Session = Depends(get_db)):
    return db.query(models.Barber).order_by(models.Barber.id.desc()).all()


@app.post("/barbers/", response_model=schemas.Barber)
def create_barber(barber: schemas.BarberCreate, db: Session = Depends(get_db)):
    normalized_email = (barber.username or "").strip().lower()
    raw_password = (barber.password or "").strip()

    if not normalized_email:
        raise HTTPException(status_code=400, detail="Sartarosh login emaili majburiy")
    if not raw_password:
        raise HTTPException(status_code=400, detail="Sartarosh login paroli majburiy")

    existing_barber = db.query(models.Barber).filter(func.lower(models.Barber.username) == normalized_email).first()
    if existing_barber:
        raise HTTPException(status_code=400, detail="Bu email allaqachon sartaroshga biriktirilgan")

    db_barber = models.Barber(
        name=barber.name.strip(),
        specialty=barber.specialty.strip(),
        phone=barber.phone.strip(),
        rating=barber.rating,
        total_cuts=barber.total_cuts,
        today_cuts=barber.today_cuts,
        status=barber.status,
        color=barber.color,
        gradient=barber.gradient,
        photo_url=barber.photo_url,
        years_experience=barber.years_experience,
        username=normalized_email,
        password=hash_password(raw_password),
        role="barber",
        bio=barber.bio,
        barbershop_id=barber.barbershop_id,
    )
    db.add(db_barber)
    db.commit()
    db.refresh(db_barber)
    seed_barber_appointments_if_empty(db, db_barber)

    schedule_realtime(
        "bookings",
        "barber.admin.created",
        {
            "barber_id": db_barber.id,
            "name": db_barber.name,
            "specialty": db_barber.specialty,
            "status": db_barber.status,
            "photo_url": db_barber.photo_url,
        },
    )

    return db_barber


@app.put("/barbers/{barber_id}", response_model=schemas.Barber)
def update_barber(barber_id: int, barber: schemas.BarberUpdate, db: Session = Depends(get_db)):
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    normalized_email = (barber.username or "").strip().lower()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Sartarosh login emaili majburiy")

    existing_barber = db.query(models.Barber).filter(
        func.lower(models.Barber.username) == normalized_email,
        models.Barber.id != barber_id,
    ).first()
    if existing_barber:
        raise HTTPException(status_code=400, detail="Bu email allaqachon boshqa sartaroshga biriktirilgan")

    db_barber.name = barber.name.strip()
    db_barber.specialty = barber.specialty.strip()
    db_barber.phone = barber.phone.strip()
    db_barber.rating = barber.rating
    db_barber.total_cuts = barber.total_cuts
    db_barber.today_cuts = barber.today_cuts
    db_barber.status = barber.status
    db_barber.color = barber.color
    db_barber.gradient = barber.gradient
    db_barber.photo_url = barber.photo_url
    db_barber.years_experience = barber.years_experience
    db_barber.username = normalized_email
    db_barber.role = "barber"

    incoming_password = (barber.password or "").strip()
    if incoming_password:
        db_barber.password = hash_password(incoming_password)

    db_barber.bio = barber.bio
    db_barber.barbershop_id = barber.barbershop_id

    db.commit()
    db.refresh(db_barber)

    schedule_realtime(
        "bookings",
        "barber.admin.updated",
        {
            "barber_id": db_barber.id,
            "name": db_barber.name,
            "specialty": db_barber.specialty,
            "status": db_barber.status,
            "photo_url": db_barber.photo_url,
            "years_experience": db_barber.years_experience,
        },
    )

    schedule_realtime(
        f"barber:{db_barber.id}",
        "barber.admin.updated",
        {
            "barber_id": db_barber.id,
            "name": db_barber.name,
            "specialty": db_barber.specialty,
            "status": db_barber.status,
            "photo_url": db_barber.photo_url,
        },
    )

    return db_barber


@app.get("/barbers/{barber_id}/profile", response_model=schemas.BarberProfile)
def get_barber_profile(barber_id: int, db: Session = Depends(get_db)):
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    return {
        "id": db_barber.id,
        "name": db_barber.name,
        "email": db_barber.username or "",
        "photo_url": db_barber.photo_url,
        "specialty": db_barber.specialty,
        "work_directions": db_barber.work_directions,
        "service_price": db_barber.service_price,
        "discount_percent": clamp_discount_percent(db_barber.discount_percent),
        "location_address": db_barber.location_address,
        "location_latitude": db_barber.location_latitude,
        "location_longitude": db_barber.location_longitude,
    }


@app.put("/barbers/{barber_id}/profile", response_model=schemas.BarberProfile)
def update_barber_profile(barber_id: int, payload: schemas.BarberProfileUpdate, db: Session = Depends(get_db)):
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    normalized_email = payload.email.strip().lower()
    normalized_name = payload.name.strip()
    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email majburiy")
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Ism majburiy")

    existing_barber = db.query(models.Barber).filter(
        func.lower(models.Barber.username) == normalized_email,
        models.Barber.id != barber_id,
    ).first()
    if existing_barber:
        raise HTTPException(status_code=400, detail="Bu email boshqa sartaroshga biriktirilgan")

    previous_discount = clamp_discount_percent(db_barber.discount_percent)

    db_barber.name = normalized_name
    db_barber.username = normalized_email
    db_barber.photo_url = (payload.photo_url or "").strip() or None

    if payload.specialty is not None and payload.specialty.strip():
        db_barber.specialty = payload.specialty.strip()

    if payload.work_directions is not None:
        db_barber.work_directions = payload.work_directions.strip() or None

    if payload.service_price is not None:
        if payload.service_price < 0:
            raise HTTPException(status_code=400, detail="Narx manfiy bo'lishi mumkin emas")
        db_barber.service_price = float(payload.service_price)

    if payload.discount_percent is not None:
        db_barber.discount_percent = clamp_discount_percent(payload.discount_percent)

    if payload.location_address is not None:
        db_barber.location_address = payload.location_address.strip() or None

    if payload.location_latitude is not None:
        db_barber.location_latitude = float(payload.location_latitude)

    if payload.location_longitude is not None:
        db_barber.location_longitude = float(payload.location_longitude)

    next_password = (payload.password or "").strip()
    if next_password:
        password_error = get_password_policy_error(next_password)
        if password_error:
            raise HTTPException(status_code=400, detail=password_error)
        db_barber.password = hash_password(next_password)

    db.commit()
    db.refresh(db_barber)

    schedule_realtime(
        "bookings",
        "barber.profile.updated",
        {
            "barber_id": db_barber.id,
            "name": db_barber.name,
            "specialty": db_barber.specialty,
            "work_directions": db_barber.work_directions,
            "service_price": get_barber_service_price(db_barber, db_barber.specialty),
            "discount_percent": clamp_discount_percent(db_barber.discount_percent),
            "location_address": db_barber.location_address,
            "location_latitude": db_barber.location_latitude,
            "location_longitude": db_barber.location_longitude,
        },
    )
    schedule_realtime(
        f"barber:{db_barber.id}",
        "barber.profile.updated",
        {
            "barber_id": db_barber.id,
            "service_price": get_barber_service_price(db_barber, db_barber.specialty),
            "discount_percent": clamp_discount_percent(db_barber.discount_percent),
        },
    )

    updated_discount = clamp_discount_percent(db_barber.discount_percent)
    if updated_discount > 0 and updated_discount != previous_discount:
        sync_notification_id_sequence(db)
        discount_notification = models.Notification(
            user_id=db_barber.id,
            title="Yangi skidka sozlandi",
            message=f"Bugungi skidka: {int(updated_discount)}%",
            type="barber_discount",
        )
        db.add(discount_notification)
        db.commit()
        db.refresh(discount_notification)
        schedule_realtime(
            f"barber:{db_barber.id}",
            "barber.notification",
            {
                "id": discount_notification.id,
                "title": discount_notification.title,
                "message": discount_notification.message,
                "type": discount_notification.type,
                "read": discount_notification.read,
                "created_at": discount_notification.created_at.isoformat() if discount_notification.created_at else None,
            },
        )

    return {
        "id": db_barber.id,
        "name": db_barber.name,
        "email": db_barber.username or "",
        "photo_url": db_barber.photo_url,
        "specialty": db_barber.specialty,
        "work_directions": db_barber.work_directions,
        "service_price": get_barber_service_price(db_barber, db_barber.specialty),
        "discount_percent": clamp_discount_percent(db_barber.discount_percent),
    }


@app.delete("/barbers/{barber_id}")
@app.delete("/barbers/{barber_id}/", include_in_schema=False)
def delete_barber(barber_id: int, db: Session = Depends(get_db)):
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    deleted_payload = {
        "barber_id": db_barber.id,
        "name": db_barber.name,
        "specialty": db_barber.specialty,
        "status": "deleted",
    }

    try:
        db.query(models.BarberAppointment).filter(models.BarberAppointment.barber_id == barber_id).delete(
            synchronize_session=False
        )
        db.delete(db_barber)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Sartaroshni o'chirishda server xatoligi")

    schedule_realtime("bookings", "barber.admin.deleted", deleted_payload)

    return {"message": "deleted"}


@app.get("/barbers/{barber_id}/dashboard", response_model=schemas.BarberDashboardResponse)
def get_barber_dashboard(barber_id: int, db: Session = Depends(get_db)):
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    seed_barber_appointments_if_empty(db, db_barber)

    today = today_tashkent_str()
    appointments = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.barber_id == barber_id,
        models.BarberAppointment.appointment_date == today,
    ).order_by(models.BarberAppointment.id.asc()).all()

    total = len(appointments)
    done = len([item for item in appointments if item.status == "completed"])
    pending = len([item for item in appointments if item.status == "pending"])
    next_item = next((item for item in appointments if item.status == "pending"), None)

    ratio = 0.0
    if total > 0:
        ratio = done / total

    return {
        "barber_id": db_barber.id,
        "barber_name": db_barber.name,
        "today_total": total,
        "today_done": done,
        "today_pending": pending,
        "progress_ratio": ratio,
        "next_appointment": next_item,
        "today_appointments": appointments,
    }


@app.get("/barbers/{barber_id}/appointments", response_model=List[schemas.BarberAppointment])
def get_barber_appointments(
    barber_id: int,
    date: Optional[str] = None,
    status_filter: str = "all",
    db: Session = Depends(get_db),
):
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    target_date = date or today_tashkent_str()

    query = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.barber_id == barber_id,
        models.BarberAppointment.appointment_date == target_date,
    )
    if status_filter in {"pending", "completed"}:
        query = query.filter(models.BarberAppointment.status == status_filter)

    return query.order_by(models.BarberAppointment.id.asc()).all()


@app.get("/user/barbers", response_model=List[schemas.UserBookingBarber])
def get_user_booking_barbers(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    max_distance_km: float = 12.0,
    near_only: bool = True,
    db: Session = Depends(get_db),
):
    seed_barbershops_if_empty(db)
    rows = db.query(models.Barber).order_by(models.Barber.name.asc()).all()
    normalized_max_distance = max(0.5, min(float(max_distance_km or 12.0), 100.0))

    payload = []
    for item in rows:
        shop = item.barbershop
        location_latitude = item.location_latitude if item.location_latitude is not None else (shop.latitude if shop is not None else None)
        location_longitude = item.location_longitude if item.location_longitude is not None else (shop.longitude if shop is not None else None)
        location_address = (item.location_address or "").strip() or (shop.address if shop is not None else None)
        distance_km = None
        if lat is not None and lng is not None and location_latitude is not None and location_longitude is not None:
            distance_km = round(haversine_distance_km(lat, lng, location_latitude, location_longitude), 2)

        if lat is not None and lng is not None and near_only:
            if distance_km is None or distance_km > normalized_max_distance:
                continue

        payload.append(
            {
                "id": item.id,
                "name": item.name,
                "specialty": item.specialty,
                "work_directions": item.work_directions,
                "rating": item.rating,
                "years_experience": item.years_experience,
                "photo_url": item.photo_url,
                "bio": item.bio,
                "phone": item.phone,
                "total_cuts": item.total_cuts,
                "status": item.status,
                "color": item.color,
                "service_price": get_discounted_price(
                    get_barber_service_price(item, item.specialty),
                    item.discount_percent,
                ),
                "discount_percent": clamp_discount_percent(item.discount_percent),
                "distance_km": distance_km,
                "barbershop_name": shop.name if shop is not None else None,
                "barbershop_address": location_address,
                "location_latitude": location_latitude,
                "location_longitude": location_longitude,
            }
        )

    payload.sort(key=lambda entry: entry.get("distance_km") if entry.get("distance_km") is not None else 99999)
    return payload


@app.get("/public/barbershops", response_model=List[schemas.PublicBarbershopMapItem])
def get_public_barbershops(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    scope: str = "near",
    db: Session = Depends(get_db),
):
    seed_barbershops_if_empty(db)
    rows = db.query(models.Barbershop).order_by(models.Barbershop.id.asc()).all()
    payload = [serialize_public_barbershop(item, lat, lng) for item in rows]

    if lat is not None and lng is not None:
        payload.sort(key=lambda row: row.get("distance_km") if row.get("distance_km") is not None else 99999)
        normalized_scope = (scope or "near").strip().lower()
        if normalized_scope == "near":
            payload = [item for item in payload if (item.get("distance_km") or 99999) <= 12.0]
        elif normalized_scope == "far":
            payload = [item for item in payload if (item.get("distance_km") or 0) > 12.0]

    return payload


@app.get("/public/barbershops/{shop_id}", response_model=schemas.PublicBarbershopDetail)
def get_public_barbershop_detail(shop_id: int, lat: Optional[float] = None, lng: Optional[float] = None, db: Session = Depends(get_db)):
    seed_barbershops_if_empty(db)
    shop = db.query(models.Barbershop).filter(models.Barbershop.id == shop_id).first()
    if shop is None:
        raise HTTPException(status_code=404, detail="Sartaroshxona topilmadi")

    return serialize_public_barbershop(shop, lat, lng)


@app.post("/barbershops", response_model=schemas.PublicBarbershopMapItem)
def create_barbershop(payload: schemas.BarbershopCreateUpdate, db: Session = Depends(get_db)):
    shop = models.Barbershop(
        name=payload.name.strip(),
        address=payload.address.strip(),
        latitude=float(payload.latitude),
        longitude=float(payload.longitude),
        photo_url=(payload.photo_url or "").strip() or None,
        description=(payload.description or "").strip() or None,
    )
    db.add(shop)
    db.commit()
    db.refresh(shop)

    body = serialize_public_barbershop(shop, None, None)
    schedule_realtime("public-map", "barbershop.created", body)
    return body


@app.put("/barbershops/{shop_id}", response_model=schemas.PublicBarbershopMapItem)
def update_barbershop(shop_id: int, payload: schemas.BarbershopCreateUpdate, db: Session = Depends(get_db)):
    shop = db.query(models.Barbershop).filter(models.Barbershop.id == shop_id).first()
    if shop is None:
        raise HTTPException(status_code=404, detail="Sartaroshxona topilmadi")

    shop.name = payload.name.strip()
    shop.address = payload.address.strip()
    shop.latitude = float(payload.latitude)
    shop.longitude = float(payload.longitude)
    shop.photo_url = (payload.photo_url or "").strip() or None
    shop.description = (payload.description or "").strip() or None
    shop.updated_at = now_tashkent()

    db.commit()
    db.refresh(shop)

    body = serialize_public_barbershop(shop, None, None)
    schedule_realtime("public-map", "barbershop.updated", body)
    return body


@app.post("/barbershops/{shop_id}/assign-barber", response_model=schemas.PublicBarbershopDetail)
def assign_barber_to_barbershop(
    shop_id: int,
    payload: schemas.BarbershopAssignBarberRequest,
    db: Session = Depends(get_db),
):
    shop = db.query(models.Barbershop).filter(models.Barbershop.id == shop_id).first()
    if shop is None:
        raise HTTPException(status_code=404, detail="Sartaroshxona topilmadi")

    barber = db.query(models.Barber).filter(models.Barber.id == payload.barber_id).first()
    if barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    barber.barbershop_id = shop_id
    barber.updated_at = now_tashkent()
    db.commit()
    db.refresh(shop)

    body = serialize_public_barbershop(shop, None, None)
    schedule_realtime("public-map", "barbershop.assigned", body)
    return body


@app.get("/user/barbers/{barber_id}/availability", response_model=schemas.BarberAvailabilityResponse)
def get_user_barber_availability(barber_id: int, date: Optional[str] = None, db: Session = Depends(get_db)):
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    target_date = (date or today_tashkent_str()).strip()
    if not target_date:
        raise HTTPException(status_code=400, detail="Sana noto'g'ri")

    booked_rows = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.barber_id == barber_id,
        models.BarberAppointment.appointment_date == target_date,
        models.BarberAppointment.status.in_(["pending", "completed"]),
    ).all()
    booked_times = {item.appointment_time for item in booked_rows}

    return {
        "barber_id": db_barber.id,
        "barber_name": db_barber.name,
        "date": target_date,
        "slots": [
            {"time": slot, "status": "booked" if slot in booked_times else "available"}
            for slot in BARBER_TIME_SLOTS
        ],
    }


@app.post("/user/bookings", response_model=schemas.UserBookingConfirmation)
def create_user_booking(payload: schemas.UserBookingCreateRequest, db: Session = Depends(get_db)):
    db_barber = db.query(models.Barber).filter(models.Barber.id == payload.barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    target_date = payload.appointment_date.strip()
    target_time = payload.appointment_time.strip()
    if not target_date or not target_time:
        raise HTTPException(status_code=400, detail="Sana va vaqt majburiy")

    if target_time not in BARBER_TIME_SLOTS:
        raise HTTPException(status_code=400, detail="Tanlangan vaqt noto'g'ri")

    existing = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.barber_id == payload.barber_id,
        models.BarberAppointment.appointment_date == target_date,
        models.BarberAppointment.appointment_time == target_time,
        models.BarberAppointment.status.in_(["pending", "completed"]),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Bu vaqt band, boshqa vaqt tanlang")

    normalized_phone = normalize_phone(payload.client_phone)
    if normalized_phone:
        pending_rows = db.query(models.BarberAppointment).filter(
            models.BarberAppointment.status == "pending",
            models.BarberAppointment.appointment_date >= today_tashkent_str(),
        ).all()
        duplicate_pending = next(
            (row for row in pending_rows if normalize_phone(row.client_phone) == normalized_phone),
            None,
        )
        if duplicate_pending:
            raise HTTPException(
                status_code=409,
                detail="Siz avval bron qilgansiz. Sartarosh tasdiqlagach yana bron qilishingiz mumkin.",
            )

    service_name = (payload.service_name or db_barber.specialty or "Haircut").strip()
    appointment = models.BarberAppointment(
        barber_id=db_barber.id,
        client_name=payload.client_name.strip(),
        client_phone=payload.client_phone.strip(),
        appointment_time=target_time,
        appointment_date=target_date,
        status="pending",
        service_name=service_name,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    booking_event_payload = appointment_realtime_payload(appointment, db_barber.name)
    schedule_realtime("bookings", "booking.created", booking_event_payload)
    schedule_realtime(f"barber:{db_barber.id}", "booking.created", booking_event_payload)

    return {
        "booking_id": format_booking_code(appointment.id),
        "appointment_id": appointment.id,
        "barber_id": db_barber.id,
        "barber_name": db_barber.name,
        "barber_specialty": db_barber.specialty,
        "barber_photo_url": db_barber.photo_url,
        "appointment_date": appointment.appointment_date,
        "appointment_time": appointment.appointment_time,
        "client_name": appointment.client_name,
        "client_phone": appointment.client_phone,
        "service_name": appointment.service_name,
        "service_price": get_discounted_price(
            get_barber_service_price(db_barber, appointment.service_name),
            db_barber.discount_percent,
        ),
        "discount_percent": clamp_discount_percent(db_barber.discount_percent),
        "created_at": appointment.created_at,
        "status": appointment.status,
    }


@app.get("/bookings/", response_model=List[schemas.AdminBookingRow])
def read_bookings(
    date: Optional[str] = None,
    status_filter: str = "all",
    db: Session = Depends(get_db),
):
    query = db.query(models.BarberAppointment, models.Barber).join(
        models.Barber,
        models.BarberAppointment.barber_id == models.Barber.id,
    )

    if date:
        query = query.filter(models.BarberAppointment.appointment_date == date.strip())

    normalized_status = status_filter.strip().lower()
    if normalized_status in {"pending", "completed", "cancelled"}:
        query = query.filter(models.BarberAppointment.status == normalized_status)

    rows = query.order_by(models.BarberAppointment.appointment_date.desc(), models.BarberAppointment.id.desc()).all()

    return [
        {
            "id": format_booking_code(appointment.id),
            "client": appointment.client_name,
            "phone": appointment.client_phone,
            "barber": barber.name,
            "service": appointment.service_name or barber.specialty or "Haircut",
            "price": get_discounted_price(
                get_barber_service_price(barber, appointment.service_name),
                barber.discount_percent,
            ),
            "time": appointment.appointment_time,
            "date": appointment.appointment_date,
            "status": normalize_status_for_admin(appointment.status),
        }
        for appointment, barber in rows
    ]


@app.patch("/barbers/{barber_id}/appointments/{appointment_id}/complete", response_model=schemas.BarberAppointment)
def complete_barber_appointment(barber_id: int, appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.id == appointment_id,
        models.BarberAppointment.barber_id == barber_id,
    ).first()
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment topilmadi")

    appointment.status = "completed"
    appointment.updated_at = now_tashkent()
    db.commit()
    db.refresh(appointment)
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    completion_event_payload = appointment_realtime_payload(appointment, db_barber.name if db_barber else None)
    schedule_realtime("bookings", "booking.completed", completion_event_payload)
    schedule_realtime(f"barber:{barber_id}", "booking.completed", completion_event_payload)
    return appointment


@app.patch("/barbers/{barber_id}/appointments/{appointment_id}/approve", response_model=schemas.BarberAppointment)
def approve_barber_appointment(barber_id: int, appointment_id: int, db: Session = Depends(get_db)):
    return complete_barber_appointment(barber_id, appointment_id, db)


@app.patch("/barbers/{barber_id}/appointments/{appointment_id}/reject", response_model=schemas.BarberAppointment)
def reject_barber_appointment(barber_id: int, appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.id == appointment_id,
        models.BarberAppointment.barber_id == barber_id,
    ).first()
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment topilmadi")

    appointment.status = "cancelled"
    appointment.updated_at = now_tashkent()
    db.commit()
    db.refresh(appointment)
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    reject_event_payload = appointment_realtime_payload(appointment, db_barber.name if db_barber else None)
    schedule_realtime("bookings", "booking.cancelled", reject_event_payload)
    schedule_realtime(f"barber:{barber_id}", "booking.cancelled", reject_event_payload)
    
    # Send SMS to user
    if appointment.student_id:
        user = db.query(models.Student).filter(models.Student.id == appointment.student_id).first()
        if user and user.phone:
            send_sms_via_webhook(user.phone, f"Kechirasiz, sartarosh {db_barber.name if db_barber else 'Unknown'} sizning broningizni rad etdi.")
    
    return appointment


@app.patch("/barbers/{barber_id}/appointments/{appointment_id}/accept", response_model=schemas.BarberAppointment)
def accept_barber_appointment(barber_id: int, appointment_id: int, db: Session = Depends(get_db)):
    """Barber accepts a booking. User gets SMS notification."""
    appointment = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.id == appointment_id,
        models.BarberAppointment.barber_id == barber_id,
    ).first()
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment topilmadi")

    appointment.status = "accepted"
    appointment.updated_at = now_tashkent()
    db.commit()
    db.refresh(appointment)
    
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    
    # Send SMS + create notification for user
    if appointment.student_id:
        user = db.query(models.Student).filter(models.Student.id == appointment.student_id).first()
        if user and user.phone:
            msg = f"Sizning broningiz {db_barber.name if db_barber else 'Sartarosh'} tomonidan qabul qilindi! Vaqt: {appointment.appointment_date} {appointment.appointment_time}"
            send_sms_via_webhook(user.phone, msg)
            
            # Create user notification
            notification = models.UserNotification(
                user_id=appointment.student_id,
                notification_type="booking_accepted",
                title="Broningiz qabul qilindi",
                message=msg,
                barber_id=barber_id,
                appointment_id=appointment_id,
                sms_sent=True,
            )
            db.add(notification)
            db.commit()
    
    accept_event_payload = appointment_realtime_payload(appointment, db_barber.name if db_barber else None)
    schedule_realtime("bookings", "booking.accepted", accept_event_payload)
    schedule_realtime(f"barber:{barber_id}", "booking.accepted", accept_event_payload)
    
    return appointment


@app.post("/appointments/{appointment_id}/rate")
def rate_appointment(appointment_id: int, payload: dict, current_user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """User rates the appointment (1-5 stars) after barber accepts it."""
    user_id = current_user.get("user_id")
    rating = payload.get("rating")
    
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Baho 1 dan 5 gacha bo'lishi kerak")
    
    appointment = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.id == appointment_id,
        models.BarberAppointment.student_id == user_id,
    ).first()
    
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment topilmadi yoki sizga tegishli emas")
    
    if appointment.status != "accepted":
        raise HTTPException(status_code=400, detail="Faqat qabul qilingan broningizni baholashingiz mumkin")
    
    appointment.user_rating = rating
    appointment.user_rated_at = now_tashkent()
    appointment.status = "rated"
    db.commit()
    db.refresh(appointment)
    
    # Update barber rating
    db_barber = db.query(models.Barber).filter(models.Barber.id == appointment.barber_id).first()
    if db_barber:
        previous_votes = int(db_barber.rating_votes or 0)
        previous_rating = float(db_barber.rating or 0)
        next_votes = previous_votes + 1
        next_rating = ((previous_rating * previous_votes) + rating) / max(1, next_votes)
        db_barber.rating_votes = next_votes
        db_barber.rating = round(next_rating, 2)
        db_barber.updated_at = now_tashkent()
        db.commit()
        
        # Send SMS to barber
        msg = f"Siz {rating} ⭐ baholandiniz! Sizning yangi o'rtacha baho: {next_rating}/5"
        send_sms_via_webhook(db_barber.phone, msg)
        
        # Create notification for barber
        barber_notif = models.UserNotification(
            user_id=db_barber.id,
            notification_type="booking_rated",
            title=f"Yangi baho: {rating} ⭐",
            message=msg,
            appointment_id=appointment_id,
            sms_sent=True,
        )
        db.add(barber_notif)
        db.commit()
    
    return {"success": True, "rating": rating, "appointment_id": appointment_id}


@app.get("/user/notifications")
def get_user_notifications(current_user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Get user's booking notifications."""
    user_id = current_user.get("user_id")
    notifications = db.query(models.UserNotification).filter(
        models.UserNotification.user_id == user_id
    ).order_by(models.UserNotification.created_at.desc()).limit(50).all()
    
    return [
        {
            "id": n.id,
            "type": n.notification_type,
            "title": n.title,
            "message": n.message,
            "barber_id": n.barber_id,
            "appointment_id": n.appointment_id,
            "sms_sent": n.sms_sent,
            "voice_sent": n.voice_sent,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifications
    ]


@app.patch("/user/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, current_user: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Mark notification as read."""
    user_id = current_user.get("user_id")
    notification = db.query(models.UserNotification).filter(
        models.UserNotification.id == notification_id,
        models.UserNotification.user_id == user_id,
    ).first()
    
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification topilmadi")
    
    notification.is_read = True
    db.commit()
    
    return {"success": True}


@app.post("/barbers/{barber_id}/appointments/{appointment_id}/send-sms")
def send_barber_appointment_sms(
    barber_id: int,
    appointment_id: int,
    message: Optional[str] = None,
    db: Session = Depends(get_db),
):
    appointment = db.query(models.BarberAppointment).filter(
        models.BarberAppointment.id == appointment_id,
        models.BarberAppointment.barber_id == barber_id,
    ).first()
    if appointment is None:
        raise HTTPException(status_code=404, detail="Appointment topilmadi")

    sms_text = (message or "Assalomu alaykum. Broningiz qabul qilindi, tez orada siz bilan bog'lanamiz.").strip()
    sent = send_sms_via_webhook(appointment.client_phone, sms_text)

    schedule_realtime(
        f"barber:{barber_id}",
        "booking.sms",
        {
            "appointment_id": appointment.id,
            "booking_id": format_booking_code(appointment.id),
            "client_phone": appointment.client_phone,
            "sent": sent,
        },
    )

    return {
        "success": sent,
        "appointment_id": appointment.id,
        "message": "SMS yuborildi" if sent else "SMS yuborilmadi",
    }


@app.post("/barbers/{barber_id}/ratings", response_model=schemas.BarberRatingResponse)
def submit_barber_rating(
    barber_id: int,
    payload: schemas.BarberRatingCreate,
    db: Session = Depends(get_db),
):
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if db_barber is None:
        raise HTTPException(status_code=404, detail="Sartarosh topilmadi")

    if payload.score < 1 or payload.score > 5:
        raise HTTPException(status_code=400, detail="Baho 1 dan 5 gacha bo'lishi kerak")

    previous_votes = int(db_barber.rating_votes or 0)
    previous_rating = float(db_barber.rating or 0)
    next_votes = previous_votes + 1
    next_rating = ((previous_rating * previous_votes) + payload.score) / max(1, next_votes)

    db_barber.rating_votes = next_votes
    db_barber.rating = round(next_rating, 2)
    db_barber.updated_at = now_tashkent()

    author_name = (payload.user_name or "Mijoz").strip() or "Mijoz"
    sync_notification_id_sequence(db)
    rating_notification = models.Notification(
        user_id=db_barber.id,
        title="Yangi baho",
        message=f"{author_name} sizga {payload.score} bal berdi",
        type="barber_rating",
    )
    db.add(rating_notification)

    db.commit()
    db.refresh(db_barber)
    db.refresh(rating_notification)

    schedule_realtime(
        f"barber:{barber_id}",
        "barber.rating.updated",
        {
            "barber_id": barber_id,
            "rating": db_barber.rating,
            "rating_votes": db_barber.rating_votes,
            "score": payload.score,
        },
    )

    schedule_realtime(
        f"barber:{barber_id}",
        "barber.notification",
        {
            "id": rating_notification.id,
            "title": rating_notification.title,
            "message": rating_notification.message,
            "type": rating_notification.type,
            "read": rating_notification.read,
            "created_at": rating_notification.created_at.isoformat() if rating_notification.created_at else None,
        },
    )

    schedule_realtime(
        "bookings",
        "barber.rating.updated",
        {
            "barber_id": barber_id,
            "rating": db_barber.rating,
            "rating_votes": db_barber.rating_votes,
        },
    )

    return {
        "barber_id": barber_id,
        "rating": db_barber.rating,
        "rating_votes": db_barber.rating_votes,
    }


@app.get("/barbers/{barber_id}/notifications", response_model=List[schemas.BarberNotificationRow])
def get_barber_notifications(barber_id: int, db: Session = Depends(get_db)):
    rows = db.query(models.Notification).filter(
        models.Notification.user_id == barber_id,
        models.Notification.type.in_(["barber_rating", "barber_discount", "barber_system"]),
    ).order_by(models.Notification.created_at.desc()).all()

    return [
        {
            "id": item.id,
            "barber_id": barber_id,
            "title": item.title,
            "message": item.message,
            "type": item.type,
            "read": item.read,
            "created_at": item.created_at,
        }
        for item in rows
    ]


@app.put("/barbers/{barber_id}/notifications/{notification_id}/read", response_model=schemas.BarberNotificationRow)
def mark_barber_notification_read(barber_id: int, notification_id: int, db: Session = Depends(get_db)):
    row = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == barber_id,
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Habarnoma topilmadi")

    row.read = True
    db.commit()
    db.refresh(row)

    return {
        "id": row.id,
        "barber_id": barber_id,
        "title": row.title,
        "message": row.message,
        "type": row.type,
        "read": row.read,
        "created_at": row.created_at,
    }

# Students
@app.get("/students/", response_model=List[schemas.Student])
def read_students(db: Session = Depends(get_db)):
    cache_key = "students:list"
    cached = cache_get_json(cache_key)
    if cached is not None:
        return cached

    rows = db.query(models.Student).all()
    payload = [schemas.Student.model_validate(item).model_dump(mode="json") for item in rows]
    cache_set_json(cache_key, payload)
    return payload

@app.post("/students/", response_model=schemas.Student)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Student).filter(models.Student.email == student.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu email allaqachon ro'yxatdan o'tgan")

    hashed_password = hash_password(student.password)
    db_student = models.Student(
        name=student.name,
        email=student.email,
        password=hashed_password,
        avatar=student.avatar,
        phone=student.phone,
        telegram=student.telegram,
        role="student",
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    invalidate_reference_caches()

    emit_role_events("admin", "student.created", {"student_id": db_student.id, "name": db_student.name})
    emit_role_events("student", "student.created", {"student_id": db_student.id, "name": db_student.name}, user_id=db_student.id)

    return {
        "id": db_student.id,
        "name": db_student.name,
        "email": db_student.email,
        "avatar": db_student.avatar,
        "phone": db_student.phone,
        "telegram": db_student.telegram
    }

@app.put("/students/{student_id}", response_model=schemas.Student)
def update_student(student_id: int, student: schemas.StudentCreate, db: Session = Depends(get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if db_student is None: raise HTTPException(status_code=404)
    db_student.name = student.name
    db_student.email = student.email
    db_student.avatar = student.avatar
    db_student.phone = student.phone
    db_student.telegram = student.telegram
    db_student.password = hash_password(student.password)
    db_student.role = "student"
    db.commit()
    db.refresh(db_student)
    invalidate_reference_caches()
    emit_role_events("admin", "student.updated", {"student_id": db_student.id, "name": db_student.name})
    emit_role_events("student", "student.updated", {"student_id": db_student.id, "name": db_student.name}, user_id=db_student.id)
    return db_student

@app.get("/students/{student_id}/profile", response_model=schemas.StudentProfile)
def get_student_profile(student_id: int, db: Session = Depends(get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if db_student is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    return {
        "id": db_student.id,
        "name": db_student.name,
        "email": "" if is_phone_placeholder_email(db_student.email) else db_student.email,
        "phone": db_student.phone,
        "avatar": db_student.avatar,
    }


@app.put("/students/{student_id}/profile", response_model=schemas.StudentProfile)
def update_student_profile(student_id: int, payload: schemas.StudentProfileUpdate, db: Session = Depends(get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if db_student is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    normalized_email = (payload.email or "").strip().lower()
    normalized_name = payload.name.strip()
    normalized_phone = normalize_phone(payload.phone or db_student.phone)
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Ism majburiy")

    # Check if phone is being changed
    if normalized_phone and normalized_phone != normalize_phone(db_student.phone):
        # Check for active/pending bookings
        active_bookings = db.query(models.BarberAppointment).filter(
            models.BarberAppointment.student_id == student_id,
            models.BarberAppointment.status.in_(["pending", "accepted"]),
        ).first()
        
        if active_bookings:
            raise HTTPException(
                status_code=400, 
                detail="Siz aktiv bron qilgansiz. Broningiz tugagunga qadar telefon raqamingizni o'zgartira olmaysiz."
            )

    if normalized_email:
        existing_student = db.query(models.Student).filter(
            func.lower(models.Student.email) == normalized_email,
            models.Student.id != student_id,
        ).first()
        if existing_student:
            raise HTTPException(status_code=400, detail="Bu email boshqa foydalanuvchiga tegishli")

    db_student.name = normalized_name
    db_student.email = normalized_email or phone_placeholder_email(normalized_phone) if normalized_phone else normalized_email
    db_student.phone = normalized_phone or db_student.phone
    db_student.avatar = (payload.avatar or "").strip() or None

    next_password = (payload.password or "").strip()
    if next_password:
        password_error = get_password_policy_error(next_password)
        if password_error:
            raise HTTPException(status_code=400, detail=password_error)
        db_student.password = hash_password(next_password)

    db.commit()
    db.refresh(db_student)
    invalidate_reference_caches()

    return {
        "id": db_student.id,
        "name": db_student.name,
        "email": "" if is_phone_placeholder_email(db_student.email) else db_student.email,
        "phone": db_student.phone,
        "avatar": db_student.avatar,
    }

@app.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if db_student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    payload = {"student_id": db_student.id, "name": db_student.name}

    try:
        assignment_ids = [
            row[0] for row in db.query(models.Assignment.id).filter(models.Assignment.student_id == student_id).all()
        ]

        if assignment_ids:
            db.query(models.Notification).filter(
                models.Notification.assignment_id.in_(assignment_ids)
            ).delete(synchronize_session=False)

            db.query(models.AssignmentProgress).filter(
                models.AssignmentProgress.assignment_id.in_(assignment_ids)
            ).delete(synchronize_session=False)

            db.query(models.Assignment).filter(
                models.Assignment.id.in_(assignment_ids)
            ).delete(synchronize_session=False)

        db.query(models.AssignmentProgress).filter(
            models.AssignmentProgress.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(models.Notification).filter(
            models.Notification.user_id == student_id
        ).delete(synchronize_session=False)

        db.query(models.Payment).filter(
            models.Payment.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(models.CourseEnrollment).filter(
            models.CourseEnrollment.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(models.Attendance).filter(
            models.Attendance.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(models.Performance).filter(
            models.Performance.student_id == student_id
        ).delete(synchronize_session=False)

        db.query(models.TelegramLinkToken).filter(
            models.TelegramLinkToken.student_id == student_id
        ).delete(synchronize_session=False)

        db.delete(db_student)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Student cannot be deleted: {str(exc.orig)}")
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Student deletion failed: {str(exc)}")

    invalidate_reference_caches()
    emit_role_events("admin", "student.deleted", payload)
    emit_role_events("student", "student.deleted", payload, user_id=payload["student_id"])
    return {"message": "deleted"}


@app.put("/students/{student_id}/password")
def change_student_password(
    student_id: int,
    payload: schemas.StudentPasswordChangeRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.replace("Bearer ", "")
    token_payload = decode_access_token(token)
    if not token_payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    requester_role = token_payload.get("role")
    requester_user_id = token_payload.get("user_id")

    if requester_role != "student" or int(requester_user_id) != student_id:
        raise HTTPException(status_code=403, detail="You can only change your own password")

    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if db_student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    current_password = payload.current_password.strip()
    new_password = payload.new_password.strip()

    if not verify_password(current_password, db_student.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    db_student.password = hash_password(new_password)
    db.commit()

    emit_role_events("student", "student.password_updated", {"student_id": student_id}, user_id=student_id)
    return {"message": "Password updated successfully"}

# Attendance
@app.get("/attendance/", response_model=List[schemas.Attendance])
def read_attendance(
    course_id: Optional[int] = None,
    student_id: Optional[int] = None,
    date: Optional[str] = None,
    lesson_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Attendance).filter(
        models.Attendance.student_id.isnot(None),
        models.Attendance.course_id.isnot(None),
        models.Attendance.date.isnot(None),
        models.Attendance.status.isnot(None),
    )
    if course_id is not None:
        query = query.filter(models.Attendance.course_id == course_id)
    if student_id is not None:
        query = query.filter(models.Attendance.student_id == student_id)
    if date is not None:
        query = query.filter(models.Attendance.date == date)
    if lesson_id is not None:
        query = query.filter(models.Attendance.lesson_id == lesson_id)
    return query.all()

@app.get("/lessons/", response_model=List[schemas.Lesson])
def read_lessons(course_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Lesson)
    if course_id is not None:
        query = query.filter(models.Lesson.course_id == course_id)
    return query.order_by(models.Lesson.created_at.desc(), models.Lesson.id.desc()).all()

@app.post("/lessons/", response_model=schemas.Lesson)
def create_lesson(lesson: schemas.LessonCreate, db: Session = Depends(get_db)):
    topic = lesson.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Lesson topic is required")

    course = db.query(models.Course).filter(models.Course.id == lesson.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    scheduled_at = lesson.lesson_datetime
    if scheduled_at is not None:
        tashkent_tz = ZoneInfo("Asia/Tashkent")
        today_local = datetime.now(tashkent_tz).date()

        if scheduled_at.tzinfo is None:
            scheduled_local_date = scheduled_at.date()
            scheduled_at = scheduled_at.replace(tzinfo=tashkent_tz).astimezone(timezone.utc).replace(tzinfo=None)
        else:
            scheduled_local_date = scheduled_at.astimezone(tashkent_tz).date()
            scheduled_at = scheduled_at.astimezone(timezone.utc).replace(tzinfo=None)

        if scheduled_local_date != today_local:
            raise HTTPException(status_code=400, detail="Lesson faqat bugungi sana uchun yaratilishi mumkin")

    sync_table_id_sequence(db, "lesson")
    db_lesson = models.Lesson(
        course_id=lesson.course_id,
        topic=topic,
        created_at=scheduled_at or datetime.utcnow(),
    )
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)

    lesson_event_payload = {
        "lesson_id": db_lesson.id,
        "course_id": db_lesson.course_id,
        "course_name": course.name,
        "topic": db_lesson.topic,
        "created_at": db_lesson.created_at.isoformat() if db_lesson.created_at else None,
    }
    emit_role_events("admin", "lesson.created", lesson_event_payload)
    emit_role_events("teacher", "lesson.created", lesson_event_payload, user_id=course.teacher_id)

    return db_lesson

@app.post("/lessons/{lesson_id}/attendance/save", response_model=List[schemas.Attendance])
def save_lesson_attendance(lesson_id: int, payload: schemas.LessonAttendanceSaveRequest, db: Session = Depends(get_db)):
    db_lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if db_lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not payload.records:
        raise HTTPException(status_code=400, detail="Attendance records are required")

    is_edit_mode = bool(db_lesson.attendance_saved)
    if is_edit_mode and db_lesson.attendance_edit_used:
        raise HTTPException(status_code=400, detail="Attendance for this lesson can only be edited once")

    enrollment_rows = db.query(models.CourseEnrollment.student_id).filter(
        models.CourseEnrollment.course_id == db_lesson.course_id
    ).all()
    enrolled_student_ids = {row[0] for row in enrollment_rows if row[0] is not None}
    submitted_student_ids = {item.student_id for item in payload.records if item.student_id is not None}

    if enrolled_student_ids and submitted_student_ids != enrolled_student_ids:
        missing = len(enrolled_student_ids - submitted_student_ids)
        extra = len(submitted_student_ids - enrolled_student_ids)
        raise HTTPException(
            status_code=400,
            detail=f"Attendance barcha o'quvchilar uchun olinishi kerak (missing={missing}, extra={extra})",
        )

    course = db.query(models.Course).filter(models.Course.id == db_lesson.course_id).first()
    course_name = course.name if course else f"Kurs #{db_lesson.course_id}"
    lesson_date = db_lesson.created_at.strftime("%Y-%m-%d") if db_lesson.created_at else datetime.utcnow().strftime("%Y-%m-%d")
    saved_records = []
    penalty_by_student: Dict[int, int] = {}
    grade_by_student: Dict[int, Optional[float]] = {}

    for item in payload.records:
        if item.penalty_hours not in ALLOWED_ATTENDANCE_HOURS:
            raise HTTPException(status_code=400, detail="Attendance qiymati faqat 0, 2 yoki 4 bo'lishi mumkin")

        grade_value = item.score if item.score is not None else item.grade
        if grade_value is not None and (grade_value < 0 or grade_value > 100):
            raise HTTPException(status_code=400, detail="Baho 0 dan 100 gacha bo'lishi kerak")

        penalty_by_student[item.student_id] = item.penalty_hours
        grade_by_student[item.student_id] = grade_value

        existing = db.query(models.Attendance).filter(
            models.Attendance.lesson_id == lesson_id,
            models.Attendance.student_id == item.student_id,
        ).first()

        status_value = attendance_status_from_penalty_hours(item.penalty_hours)
        if existing:
            existing.course_id = db_lesson.course_id
            existing.date = lesson_date
            existing.status = status_value
            existing.penalty_hours = item.penalty_hours
            existing.late_minutes = None
            existing.grade = grade_value
            saved_records.append(existing)
            continue

        sync_table_id_sequence(db, "attendance")
        db_attendance = models.Attendance(
            student_id=item.student_id,
            course_id=db_lesson.course_id,
            lesson_id=lesson_id,
            date=lesson_date,
            status=status_value,
            penalty_hours=item.penalty_hours,
            late_minutes=None,
            grade=grade_value,
        )
        db.add(db_attendance)
        saved_records.append(db_attendance)

    if is_edit_mode:
        db_lesson.attendance_edit_used = True
    else:
        db_lesson.attendance_saved = True

    student_rows = db.query(models.Student).filter(models.Student.id.in_(list(enrolled_student_ids))).all() if enrolled_student_ids else []
    student_by_id = {student.id: student for student in student_rows}
    notification_title = "📘 Davomat yangilandi" if is_edit_mode else "📘 Davomat olindi"
    notification_type = "attendance_updated" if is_edit_mode else "attendance_saved"

    created_notifications: List[models.Notification] = []
    if enrolled_student_ids:
        sync_notification_id_sequence(db)
        for student_id in enrolled_student_ids:
            penalty_value = penalty_by_student.get(student_id)
            penalty_text = f" ({penalty_value} soat)" if penalty_value is not None else ""
            grade_value = grade_by_student.get(student_id)
            grade_text = f" Baho: {grade_value}." if grade_value is not None else ""
            message = f"{course_name} kursidagi \"{db_lesson.topic}\" lesson davomat holati yangilandi{penalty_text}.{grade_text}"
            db_notification = models.Notification(
                user_id=student_id,
                title=notification_title,
                message=message,
                type=notification_type,
            )
            db.add(db_notification)
            created_notifications.append(db_notification)

    db.commit()

    attendance_event_payload = {
        "lesson_id": db_lesson.id,
        "course_id": db_lesson.course_id,
        "course_name": course_name,
        "topic": db_lesson.topic,
        "edited": is_edit_mode,
        "records": len(saved_records),
    }
    event_name = "attendance.updated" if is_edit_mode else "attendance.saved"
    emit_role_events("admin", event_name, attendance_event_payload)
    emit_role_events("teacher", event_name, attendance_event_payload, user_id=course.teacher_id if course else None)

    for db_notification in created_notifications:
        db.refresh(db_notification)
        awaitable_payload = notification_to_payload(db_notification)
        push_notification_realtime(db_notification.user_id, awaitable_payload)

        emit_role_events(
            "student",
            event_name,
            {
                **attendance_event_payload,
                "student_id": db_notification.user_id,
                "notification_id": db_notification.id,
            },
            user_id=db_notification.user_id,
        )

        student = student_by_id.get(db_notification.user_id)
        if student:
            penalty_value = penalty_by_student.get(db_notification.user_id)
            grade_value = grade_by_student.get(db_notification.user_id)
            status_value = status_by_student.get(db_notification.user_id)
            status_text = format_attendance_status(status_value)
            penalty_text = f"\n⏱ Jarima: {penalty_value} soat" if penalty_value is not None else ""
            grade_text = f"\n🎯 Baho: {grade_value}" if grade_value is not None else ""
            telegram_message = (
                f"📘 Davomat yangilandi\n"
                f"━━━━━━━━━━━━━━\n"
                f"📚 Kurs: {course_name}\n"
                f"📝 Mavzu: {db_lesson.topic}\n"
                f"📅 Dars sanasi: {lesson_date}\n"
                f"📌 Holat: {status_text}"
                f"{penalty_text}"
                f"{grade_text}\n"
                f"🕒 Yangilandi: {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            )
            send_telegram_to_student(student, telegram_message)

        if student and not notification_manager.is_online(db_notification.user_id):
            send_sms_via_webhook(student.phone, f"{student.name}, {db_notification.message}")

    refreshed = db.query(models.Attendance).filter(models.Attendance.lesson_id == lesson_id).all()
    return refreshed

@app.post("/attendance/", response_model=schemas.Attendance)
def create_attendance(attendance: schemas.AttendanceCreate, db: Session = Depends(get_db)):
    try:
        allowed_statuses = {"present", "absent", "late"}
        if attendance.status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid attendance status")

        if not attendance.date or not attendance.date.strip():
            raise HTTPException(status_code=400, detail="Attendance date is required")

        student_exists = db.query(models.Student.id).filter(models.Student.id == attendance.student_id).first()
        if not student_exists:
            raise HTTPException(status_code=404, detail="Student not found")

        course_exists = db.query(models.Course.id).filter(models.Course.id == attendance.course_id).first()
        if not course_exists:
            raise HTTPException(status_code=404, detail="Course not found")

        existing = db.query(models.Attendance).filter(
            models.Attendance.student_id == attendance.student_id,
            models.Attendance.course_id == attendance.course_id,
            models.Attendance.date == attendance.date,
        ).first()

        if existing:
            existing.status = attendance.status
            existing.late_minutes = attendance.late_minutes
            existing.grade = attendance.grade
            db.commit()
            db.refresh(existing)
            return existing

        sync_table_id_sequence(db, "attendance")
        db_attendance = models.Attendance(**attendance.model_dump())
        db.add(db_attendance)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            sync_table_id_sequence(db, "attendance")
            db_attendance = models.Attendance(**attendance.model_dump())
            db.add(db_attendance)
            db.commit()

        db.refresh(db_attendance)
        return db_attendance
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        print(f"Attendance create error: {exc}")
        raise HTTPException(status_code=500, detail=f"Attendance save failed: {exc}")

@app.put("/attendance/{attendance_id}", response_model=schemas.Attendance)
def update_attendance(attendance_id: int, attendance: schemas.AttendanceCreate, db: Session = Depends(get_db)):
    db_attendance = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if db_attendance is None:
        raise HTTPException(status_code=404, detail="Attendance not found")

    for key, value in attendance.model_dump().items():
        setattr(db_attendance, key, value)

    db.commit()
    db.refresh(db_attendance)
    return db_attendance

@app.delete("/attendance/{attendance_id}")
def delete_attendance(attendance_id: int, db: Session = Depends(get_db)):
    db_attendance = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if db_attendance is None:
        raise HTTPException(status_code=404, detail="Attendance not found")

    db.delete(db_attendance)
    db.commit()
    return {"message": "Attendance deleted"}

# Performance
@app.get("/performance/", response_model=List[schemas.Performance])
def read_performance(db: Session = Depends(get_db)): return db.query(models.Performance).all()

@app.post("/performance/", response_model=schemas.Performance)
def create_performance(p: schemas.PerformanceCreate, db: Session = Depends(get_db)):
    db_p = models.Performance(**p.model_dump())
    db.add(db_p)

    student = db.query(models.Student).filter(models.Student.id == p.student_id).first()
    course = db.query(models.Course).filter(models.Course.id == p.course_id).first()
    course_name = course.name if course else f"Kurs #{p.course_id}"

    sync_notification_id_sequence(db)
    db_notification = models.Notification(
        user_id=p.student_id,
        title=" O'zlashtirish yangilandi",
        message=f"{course_name} kursida {p.label}: {p.score}",
        type="performance_updated",
    )
    db.add(db_notification)

    db.commit()
    db.refresh(db_p)
    db.refresh(db_notification)

    event_payload = {
        "performance_id": db_p.id,
        "student_id": p.student_id,
        "course_id": p.course_id,
        "score": p.score,
        "label": p.label,
        "type": p.type,
    }
    emit_role_events("teacher", "performance.created", event_payload)
    emit_role_events("admin", "performance.created", event_payload)
    emit_role_events("student", "performance.created", event_payload, user_id=p.student_id)

    push_notification_realtime(p.student_id, notification_to_payload(db_notification))

    if student:
        send_telegram_to_student(
            student,
            (
                f" O'zlashtirish yangilandi\n"
                f" Kurs: {course_name}\n"
                f" Ko'rsatkich: {p.label}\n"
                f" Natija: {p.score}"
            ),
        )

    return db_p

# Payment
def ensure_current_month_payments(db: Session):
    """Automatically create current-month payment rows for all active enrollments."""
    now = datetime.utcnow()
    current_month = now.strftime("%B")
    last_day = calendar.monthrange(now.year, now.month)[1]
    default_due_date = now.replace(day=last_day).strftime("%Y-%m-%d")

    enrollments = db.query(models.CourseEnrollment).all()
    # end barbers list

    for enrollment in enrollments:
        if enrollment.student_id is None or enrollment.course_id is None:
            continue

        existing = db.query(models.Payment).filter(
            models.Payment.student_id == enrollment.student_id,
            models.Payment.course_id == enrollment.course_id,
            models.Payment.month == current_month,
        ).first()

        if existing:
            continue

        course = db.query(models.Course).filter(models.Course.id == enrollment.course_id).first()
        db.add(models.Payment(
            student_id=enrollment.student_id,
            course_id=enrollment.course_id,
            amount=course.price if course else 0,
            currency="UZS",
            status="pending",
            due_date=default_due_date,
            month=current_month,
        ))
        created = True

    if created:
        db.commit()


@app.get("/payments/", response_model=List[schemas.Payment])
def read_payments(db: Session = Depends(get_db)):
    ensure_current_month_payments(db)
    return db.query(models.Payment).all()

@app.get("/payments/course/{course_id}", response_model=List[schemas.Payment])
def read_course_payments(course_id: int, db: Session = Depends(get_db)):
    """Get all payments for a specific course"""
    ensure_current_month_payments(db)
    payments = db.query(models.Payment).filter(models.Payment.course_id == course_id).all()
    return payments

@app.get("/payments/course/{course_id}/month/{month}", response_model=List[schemas.Payment])
def read_course_payments_by_month(course_id: int, month: str, db: Session = Depends(get_db)):
    """Get payments for a course in a specific month"""
    ensure_current_month_payments(db)
    payments = db.query(models.Payment).filter(
        models.Payment.course_id == course_id,
        models.Payment.month == month
    ).all()
    return payments

@app.get("/payments/student/{student_id}", response_model=List[schemas.Payment])
def read_student_payments(student_id: int, db: Session = Depends(get_db)):
    """Get all payments for a specific student"""
    ensure_current_month_payments(db)
    payments = db.query(models.Payment).filter(models.Payment.student_id == student_id).all()
    return payments

@app.get("/payments/student/{student_id}/course/{course_id}", response_model=schemas.Payment)
def read_student_course_payment(student_id: int, course_id: int, db: Session = Depends(get_db)):
    """Get specific payment for student-course combination"""
    payment = db.query(models.Payment).filter(
        models.Payment.student_id == student_id,
        models.Payment.course_id == course_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@app.post("/payments/", response_model=schemas.Payment)
def create_payment(payment: schemas.PaymentCreate, db: Session = Depends(get_db)):
    """Create a new payment record"""
    # Check if payment already exists for this student-course combination
    existing = db.query(models.Payment).filter(
        models.Payment.student_id == payment.student_id,
        models.Payment.course_id == payment.course_id,
        models.Payment.month == payment.month
    ).first()
    
    if existing:
        # Update existing payment instead
        for key, value in payment.model_dump().items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        push_payment_telegram_message(db, existing)
        return existing
    
    db_payment = models.Payment(**payment.model_dump())
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    push_payment_telegram_message(db, db_payment)
    return db_payment

@app.put("/payments/{payment_id}", response_model=schemas.Payment)
def update_payment(payment_id: int, payment: schemas.PaymentUpdate, db: Session = Depends(get_db)):
    """Update payment status and details"""
    db_payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    update_data = payment.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_payment, key, value)
    
    db.commit()
    db.refresh(db_payment)

    emit_role_events(
        "student",
        "payment.updated",
        {"payment_id": db_payment.id, "status": db_payment.status, "course_id": db_payment.course_id},
        user_id=db_payment.student_id,
    )
    emit_role_events(
        "admin",
        "payment.updated",
        {"payment_id": db_payment.id, "status": db_payment.status, "course_id": db_payment.course_id},
    )
    emit_role_events(
        "teacher",
        "payment.updated",
        {"payment_id": db_payment.id, "status": db_payment.status, "course_id": db_payment.course_id},
    )

    push_payment_telegram_message(db, db_payment)

    return db_payment

@app.post("/payments/{payment_id}/send-sms")
async def send_payment_sms(payment_id: int, db: Session = Depends(get_db)):
    """Send payment reminder notification for student panel"""
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Get student info
    student = db.query(models.Student).filter(models.Student.id == payment.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    course = db.query(models.Course).filter(models.Course.id == payment.course_id).first()
    course_name = course.name if course else f"Kurs #{payment.course_id}"

    # Create DB notification shown in student panel
    print(f"🔔 Payment reminder sent to student {student.id} for course {payment.course_id}")

    sync_notification_id_sequence(db)
    db_notification = models.Notification(
        user_id=student.id,
        title="💳 To'lov qiling",
        message=f"{course_name} kursi uchun to'lovni amalga oshiring. Miqdor: {format_uzs_amount(payment.amount)}",
        type="payment_reminder",
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)

    await notification_manager.broadcast_to_user(
        student.id,
        notification_to_payload(db_notification),
    )

    emit_role_events(
        "student",
        "notification.created",
        {"notification_id": db_notification.id, "user_id": student.id, "type": db_notification.type},
        user_id=student.id,
    )
    emit_role_events(
        "admin",
        "payment.reminder_sent",
        {"payment_id": payment.id, "student_id": student.id, "course_id": payment.course_id},
    )
    emit_role_events(
        "teacher",
        "payment.reminder_sent",
        {"payment_id": payment.id, "student_id": student.id, "course_id": payment.course_id},
    )

    send_telegram_to_student(
        student,
        (
            f"📣 To'lov eslatmasi\n"
            f"━━━━━━━━━━━━━━\n"
            f"📚 Kurs: {course_name}\n"
            f"💰 Miqdor: {format_uzs_amount(payment.amount)}\n"
            f"📝 Xabar: {db_notification.message}"
        ),
    )

    return {"message": "Notification sent", "student_name": student.name}

@app.post("/payments/send-bulk-notification")
async def send_bulk_payment_notification(payload: dict, db: Session = Depends(get_db)):
    """Send payment reminder notifications to multiple students
    
    payload: {
        "payment_ids": [1, 2, 3, ...],  # List of payment IDs to send notifications for
        "message_override": "Optional custom message"
    }
    """
    payment_ids = payload.get("payment_ids", [])
    message_override = payload.get("message_override", None)
    
    if not payment_ids:
        raise HTTPException(status_code=400, detail="No payment IDs provided")
    
    sent_count = 0
    failed_payments = []
    created_notifications: List[models.Notification] = []
    
    for payment_id in payment_ids:
        try:
            payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
            if not payment:
                failed_payments.append({"id": payment_id, "error": "Payment not found"})
                continue
            
            student = db.query(models.Student).filter(models.Student.id == payment.student_id).first()
            course = db.query(models.Course).filter(models.Course.id == payment.course_id).first()
            
            if not student:
                failed_payments.append({"id": payment_id, "error": "Student not found"})
                continue
            
            course_name = course.name if course else f"Kurs #{payment.course_id}"
            
            # Determine message based on payment status
            if message_override:
                message = message_override
            elif payment.status == "pending":
                message = f"{course_name} kursi uchun to'lovni amalga oshiring. Miqdor: {format_uzs_amount(payment.amount)}"
            elif payment.status == "paid":
                message = f"{course_name} kursi uchun to'lovni qabul qildik. Rahmat!"
            else:
                message = f"{course_name} kursi uchun to'lov statusini tekshiring."
            
            send_telegram_to_student(
                student,
                (
                    f"📬 To'lov xabari\n"
                    f"━━━━━━━━━━━━━━\n"
                    f"📚 Kurs: {course_name}\n"
                    f"💰 Miqdor: {format_uzs_amount(payment.amount)}\n"
                    f"📝 Xabar: {message}"
                ),
            )

            # Create notification
            sync_notification_id_sequence(db)
            db_notification = models.Notification(
                user_id=student.id,
                title="💳 To'lov xabarnomasla",
                message=message,
                type="payment_reminder",
            )
            db.add(db_notification)
            created_notifications.append(db_notification)
            
            sent_count += 1
        except Exception as e:
            failed_payments.append({"id": payment_id, "error": str(e)})
    
    db.commit()

    for item in created_notifications:
        db.refresh(item)
        await notification_manager.broadcast_to_user(item.user_id, notification_to_payload(item))
        emit_role_events(
            "student",
            "notification.created",
            {"notification_id": item.id, "user_id": item.user_id, "type": item.type},
            user_id=item.user_id,
        )

    if sent_count > 0:
        emit_role_events("admin", "payment.bulk_reminder_sent", {"sent_count": sent_count})
        emit_role_events("teacher", "payment.bulk_reminder_sent", {"sent_count": sent_count})
    
    return {
        "success": True,
        "sent_count": sent_count,
        "failed_count": len(failed_payments),
        "failed_payments": failed_payments if failed_payments else None
    }

# ========== REAL PAYMENT GATEWAY ENDPOINTS ==========

@app.post("/payments/real/stripe/create-intent")
def create_stripe_payment_intent(
    payload: schemas.StripeIntentRequest,
    db: Session = Depends(get_db)
):
    """Create Stripe payment intent for real card payment"""
    # Verify student and course exist
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()
    
    if not student or not course:
        raise HTTPException(status_code=404, detail="Student or course not found")
    
    # Create payment intent
    result = StripePaymentService.create_payment_intent(
        payload.amount * 100,
        payload.student_id,
        payload.course_id
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return {
        "client_secret": result["client_secret"],
        "payment_intent_id": result["payment_intent_id"],
        "amount": payload.amount,
        "currency": "UZS",
        "status": "pending"
    }

@app.post("/payments/real/stripe/confirm")
def confirm_stripe_payment(
    payload: schemas.StripeConfirmRequest,
    db: Session = Depends(get_db)
):
    """Confirm Stripe payment after client-side processing"""
    # Verify the payment with Stripe
    result = StripePaymentService.confirm_payment(payload.payment_intent_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    # Update payment in database
    payment = None
    if payload.payment_id is not None:
        payment = db.query(models.Payment).filter(models.Payment.id == payload.payment_id).first()

    if not payment:
        payment = db.query(models.Payment).filter(
            (models.Payment.student_id == payload.student_id) &
            (models.Payment.course_id == payload.course_id)
        ).first()
    
    if payment:
        payment.status = "paid"
        payment.payment_method = "stripe"
        payment.payment_details = {
            "payment_intent_id": payload.payment_intent_id,
            "charges": result.get("charges", [])
        }
        payment.paid_date = datetime.utcnow().isoformat()
        if payload.amount is not None:
            payment.amount = payload.amount
    else:
        payment = models.Payment(
            student_id=payload.student_id,
            course_id=payload.course_id,
            amount=payload.amount or 0,
            currency="UZS",
            status="paid",
            payment_method="stripe",
            payment_details={
                "payment_intent_id": payload.payment_intent_id,
                "charges": result.get("charges", [])
            },
            month=payload.month or datetime.utcnow().strftime("%Y-%m"),
            paid_date=datetime.utcnow().isoformat()
        )
        db.add(payment)
    
    db.commit()
    db.refresh(payment)
    
    # Create notifications for student and all admins
    student = db.query(models.Student).filter(models.Student.id == payment.student_id).first()
    course = db.query(models.Course).filter(models.Course.id == payment.course_id).first()
    student_name = student.name if student else f"Student #{payment.student_id}"
    course_name = course.name if course else f"Kurs #{payment.course_id}"
    paid_time = datetime.utcnow().strftime("%d.%m.%Y %H:%M")
    # Notify student
    db.add(models.Notification(
        user_id=payment.student_id,
        title="✅ To'lov qabul qilindi",
        message=f"{course_name} kursi uchun {format_uzs_amount(payment.amount)} to'lov Stripe orqali qabul qilindi. Sana: {paid_time}",
        type="payment_paid"
    ))
    # Notify all admins
    from models import Admin
    for adm in db.query(Admin).all():
        db.add(models.Notification(
            user_id=adm.id,
            title="💳 Yangi to'lov keldi",
            message=f"{student_name} → {course_name}: {format_uzs_amount(payment.amount)} (Stripe) • {paid_time}",
            type="payment_received"
        ))
    db.commit()
    
    emit_role_events(
        "student",
        "payment.updated",
        {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
        user_id=payment.student_id,
    )
    emit_role_events(
        "admin",
        "payment.updated",
        {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
    )
    emit_role_events(
        "teacher",
        "payment.updated",
        {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
    )

    return {
        "success": True,
        "payment_id": payment.id,
        "status": "paid",
        "amount": result.get("amount"),
        "message": "Payment successful. Payment status updated."
    }

@app.post("/payments/real/click/create-invoice")
async def create_click_invoice(
    payload: schemas.ClickInvoiceRequest,
    db: Session = Depends(get_db)
):
    """Create Click payment invoice for Uzbekistan"""
    # Verify student and course
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()
    
    if not student or not course:
        raise HTTPException(status_code=404, detail="Student or course not found")
    
    # Create Click invoice
    from payment_gateways import ClickPaymentService
    result = await ClickPaymentService.create_invoice(
        payload.amount,
        payload.student_id,
        payload.course_id,
        payload.phone,
        f"Course payment: {course.name}"
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return {
        "invoice_id": result.get("invoice_id"),
        "payment_url": result.get("payment_url"),
        "amount": payload.amount,
        "phone": payload.phone,
        "message": "Click invoice created. Redirect user to payment_url"
    }

@app.post("/payments/real/click/verify")
async def verify_click_payment(
    payload: schemas.ClickVerifyRequest,
    db: Session = Depends(get_db)
):
    """Verify Click payment status"""
    from payment_gateways import ClickPaymentService
    
    result = await ClickPaymentService.verify_payment(payload.transaction_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    # Update payment in database if verified
    if result.get("status") == "completed":
        payment = None
        if payload.payment_id is not None:
            payment = db.query(models.Payment).filter(models.Payment.id == payload.payment_id).first()

        if not payment:
            payment = db.query(models.Payment).filter(
                (models.Payment.student_id == payload.student_id) &
                (models.Payment.course_id == payload.course_id)
            ).first()
        
        if payment:
            payment.status = "paid"
            payment.payment_method = "click"
            payment.payment_details = {"transaction_id": payload.transaction_id}
            payment.paid_date = datetime.utcnow().isoformat()
            if payload.amount is not None:
                payment.amount = payload.amount
        else:
            payment = models.Payment(
                student_id=payload.student_id,
                course_id=payload.course_id,
                amount=payload.amount or 0,
                currency="UZS",
                status="paid",
                payment_method="click",
                payment_details={"transaction_id": payload.transaction_id},
                month=payload.month or datetime.utcnow().strftime("%Y-%m"),
                paid_date=datetime.utcnow().isoformat()
            )
            db.add(payment)
        
        db.commit()
        db.refresh(payment)
        
        # Create notifications
        student = db.query(models.Student).filter(models.Student.id == payment.student_id).first()
        course = db.query(models.Course).filter(models.Course.id == payment.course_id).first()
        student_name = student.name if student else f"Student #{payment.student_id}"
        course_name = course.name if course else f"Kurs #{payment.course_id}"
        paid_time = datetime.utcnow().strftime("%d.%m.%Y %H:%M")
        db.add(models.Notification(
            user_id=payment.student_id,
            title="✅ To'lov qabul qilindi",
            message=f"{course_name} kursi uchun {format_uzs_amount(payment.amount)} to'lov Click orqali qabul qilindi. Sana: {paid_time}",
            type="payment_paid"
        ))
        from models import Admin
        for adm in db.query(Admin).all():
            db.add(models.Notification(
                user_id=adm.id,
                title="💳 Yangi to'lov keldi",
                message=f"{student_name} → {course_name}: {format_uzs_amount(payment.amount)} (Click) • {paid_time}",
                type="payment_received"
            ))
        db.commit()

        emit_role_events(
            "student",
            "payment.updated",
            {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
            user_id=payment.student_id,
        )
        emit_role_events(
            "admin",
            "payment.updated",
            {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
        )
        emit_role_events(
            "teacher",
            "payment.updated",
            {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
        )
        
        return {
            "success": True,
            "payment_id": payment.id,
            "status": "paid",
            "message": "Click payment verified. Payment status updated."
        }
    
    return {
        "success": False,
        "status": result.get("status"),
        "message": "Payment not yet completed"
    }

@app.post("/payments/real/payme/create-receipt")
async def create_payme_receipt(
    payload: schemas.PaymeReceiptRequest,
    db: Session = Depends(get_db)
):
    """Create Payme checkout session URL for a course payment."""
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()

    if not student or not course:
        raise HTTPException(status_code=404, detail="Student or course not found")

    payment = None
    if payload.payment_id is not None:
        payment = db.query(models.Payment).filter(models.Payment.id == payload.payment_id).first()

    if not payment:
        payment = db.query(models.Payment).filter(
            (models.Payment.student_id == payload.student_id) &
            (models.Payment.course_id == payload.course_id) &
            (models.Payment.month == (payload.month or datetime.utcnow().strftime("%Y-%m")))
        ).first()

    if not payment:
        sync_table_id_sequence(db, "payment")
        payment = models.Payment(
            student_id=payload.student_id,
            course_id=payload.course_id,
            amount=payload.amount,
            currency="UZS",
            status="pending",
            payment_method="payme",
            payment_details={},
            month=payload.month or datetime.utcnow().strftime("%Y-%m"),
        )
        db.add(payment)
        db.flush()

    checkout_url = build_payme_checkout_url(payment.id, payload.amount)
    if not checkout_url:
        raise HTTPException(status_code=500, detail="PAYME_MERCHANT_ID is not configured")

    session_token = f"payme_{uuid.uuid4().hex}"
    details = payment.payment_details or {}
    details.update({
        "receipt_id": session_token,
        "checkout_url": checkout_url,
        "phone": payload.phone,
        "payme_status": "pending",
        "updated_at": datetime.utcnow().isoformat(),
    })

    payment.payment_method = "payme"
    payment.status = "pending"
    payment.amount = payload.amount
    payment.payment_details = details
    db.commit()

    return {
        "receipt_id": session_token,
        "payment_id": payment.id,
        "payment_url": checkout_url,
        "amount": payload.amount,
        "phone": payload.phone,
        "message": "Payme checkout session created"
    }

@app.post("/payments/real/payme/check-status")
async def check_payme_status(
    payload: schemas.PaymeStatusRequest,
    db: Session = Depends(get_db)
):
    """Check Payme payment status from local DB state (updated by callback)."""
    payment = None
    if payload.payment_id is not None:
        payment = db.query(models.Payment).filter(models.Payment.id == payload.payment_id).first()

    if not payment:
        payment = db.query(models.Payment).filter(
            (models.Payment.student_id == payload.student_id) &
            (models.Payment.course_id == payload.course_id)
        ).order_by(models.Payment.updated_at.desc()).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    details = payment.payment_details or {}
    receipt_id = details.get("receipt_id")
    if receipt_id and payload.receipt_id and receipt_id != payload.receipt_id:
        raise HTTPException(status_code=400, detail="Invalid receipt id")

    if payment.status == "paid":
        return {
            "success": True,
            "payment_id": payment.id,
            "status": "paid",
            "message": "Payme payment confirmed",
        }

    return {
        "success": False,
        "payment_id": payment.id,
        "status": payment.status,
        "message": "Payment not yet completed"
    }


@app.post("/payments/real/payme/webhook")
async def payme_webhook(
    request: Request,
    x_payme_signature: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    """Payme callback endpoint. Verifies signature and marks payment as paid."""
    raw_body = await request.body()
    if not verify_payme_callback_signature(raw_body, x_payme_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid Payme callback signature")

    payload = await request.json()
    payment_id_raw = payload.get("payment_id")
    status_value = str(payload.get("status", "")).lower()
    transaction_id = payload.get("transaction_id")

    if payment_id_raw is None:
        raise HTTPException(status_code=400, detail="payment_id is required")

    try:
        payment_id = int(payment_id_raw)
    except Exception:
        raise HTTPException(status_code=400, detail="payment_id must be integer")

    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    details = payment.payment_details or {}
    details.update({
        "payme_status": status_value,
        "transaction_id": transaction_id,
        "webhook_received_at": datetime.utcnow().isoformat(),
    })
    payment.payment_details = details

    if status_value in {"paid", "success", "completed", "2"}:
        payment.status = "paid"
        payment.payment_method = "payme"
        payment.paid_date = datetime.utcnow().isoformat()

        student = db.query(models.Student).filter(models.Student.id == payment.student_id).first()
        course = db.query(models.Course).filter(models.Course.id == payment.course_id).first()
        course_name = course.name if course else f"Kurs #{payment.course_id}"
        student_name = student.name if student else f"Student #{payment.student_id}"
        paid_time = datetime.utcnow().strftime("%d.%m.%Y %H:%M")

        sync_notification_id_sequence(db)
        db.add(models.Notification(
            user_id=payment.student_id,
            title="✅ To'lov qabul qilindi",
            message=f"{course_name} kursi uchun {payment.amount} UZS to'lov Payme orqali qabul qilindi. Sana: {paid_time}",
            type="payment_paid"
        ))

        from models import Admin
        for adm in db.query(Admin).all():
            db.add(models.Notification(
                user_id=adm.id,
                title="💳 Yangi to'lov keldi",
                message=f"{student_name} → {course_name}: {payment.amount} UZS (Payme) • {paid_time}",
                type="payment_received"
            ))

        emit_role_events(
            "student",
            "payment.updated",
            {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
            user_id=payment.student_id,
        )
        emit_role_events(
            "admin",
            "payment.updated",
            {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
        )
        emit_role_events(
            "teacher",
            "payment.updated",
            {"payment_id": payment.id, "status": "paid", "course_id": payment.course_id},
        )

        push_payment_telegram_message(db, payment, student=student)

    db.commit()

    return {"success": True}

@app.get("/payments/real/google-pay/config")
def get_google_pay_config(student_id: int, course_id: int):
    """Get Google Pay configuration for mobile payments"""
    from payment_gateways import GooglePayService
    
    # This would be called from mobile app to get payment config
    # Amount would come from database query in real implementation
    config = GooglePayService.create_payment_request(
        amount=50000.00,  # Example amount
        currency="UZS",
        description=f"Course payment for student {student_id}"
    )
    
    return config

# Notification
@app.get("/notifications/")
def read_notifications(user_id: Optional[int] = None, db: Session = Depends(get_db)): 
    query = db.query(models.Notification)
    if user_id is not None:
        query = query.filter(models.Notification.user_id == user_id)
    return query.order_by(models.Notification.created_at.desc()).all()

@app.post("/notifications/", response_model=schemas.Notification)
async def create_notification(notification: schemas.NotificationCreate, db: Session = Depends(get_db)):
    sync_notification_id_sequence(db)
    db_n = models.Notification(**notification.model_dump())
    db.add(db_n)
    db.commit()
    db.refresh(db_n)

    await notification_manager.broadcast_to_user(
        db_n.user_id,
        notification_to_payload(db_n),
    )

    if not notification_manager.is_online(db_n.user_id):
        student = db.query(models.Student).filter(models.Student.id == db_n.user_id).first()
        send_sms_via_webhook(student.phone if student else None, db_n.message)

    student = db.query(models.Student).filter(models.Student.id == db_n.user_id).first()
    if student:
        send_telegram_to_student(student, f"{db_n.title}\n{db_n.message}")

    emit_role_events(
        "student",
        "notification.created",
        {
            "notification_id": db_n.id,
            "user_id": db_n.user_id,
            "type": db_n.type,
        },
        user_id=db_n.user_id,
    )

    return db_n

@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    db_n = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if db_n is None: raise HTTPException(status_code=404)
    db_n.read = True
    db.commit()
    db.refresh(db_n)
    return db_n

# ========== ASSIGNMENTS ==========

@app.get("/assignments/")
def read_assignments(course_id: int = None, teacher_id: int = None, student_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Assignment)

    if course_id is not None:
        query = query.filter(models.Assignment.course_id == course_id)
    if teacher_id is not None:
        query = query.filter(models.Assignment.teacher_id == teacher_id)
    if student_id is not None:
        query = query.filter(
            (models.Assignment.student_id == student_id) |
            (models.Assignment.student_id.is_(None))
        )

    return query.order_by(models.Assignment.created_at.desc()).all()

@app.post("/assignments/", response_model=schemas.Assignment)
def create_assignment(assignment: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    db_assignment = models.Assignment(**assignment.model_dump())
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    created_notifications: List[models.Notification] = []
    
    # Create notifications
    if db_assignment.student_id:
        # Notify specific student
        db_n = models.Notification(
            user_id=db_assignment.student_id,
            title="Yangi vazifa",
            message=f"Sizga yangi vazifa berildi: {db_assignment.title}",
            type="assignment_created",
            assignment_id=db_assignment.id
        )
        db.add(db_n)
        created_notifications.append(db_n)
    else:
        # Notify all students in course
        enrollments = db.query(models.CourseEnrollment).filter(
            models.CourseEnrollment.course_id == db_assignment.course_id
        ).all()
        for enrollment in enrollments:
            db_n = models.Notification(
                user_id=enrollment.student_id,
                title="Yangi kurs vazifasi",
                message=f"Kursga yangi vazifa berildi: {db_assignment.title}",
                type="assignment_created",
                assignment_id=db_assignment.id
            )
            db.add(db_n)
            created_notifications.append(db_n)
    
    db.commit()

    for item in created_notifications:
        db.refresh(item)
        push_notification_realtime(item.user_id, notification_to_payload(item))
        emit_role_events(
            "student",
            "notification.created",
            {"notification_id": item.id, "user_id": item.user_id, "type": item.type},
            user_id=item.user_id,
        )
        student = db.query(models.Student).filter(models.Student.id == item.user_id).first()
        if student:
            send_telegram_to_student(student, f"Homework: {item.message}")

    assignment_event = {
        "assignment_id": db_assignment.id,
        "course_id": db_assignment.course_id,
        "teacher_id": db_assignment.teacher_id,
        "student_id": db_assignment.student_id,
        "title": db_assignment.title,
    }
    emit_role_events("teacher", "assignment.created", assignment_event, user_id=db_assignment.teacher_id)
    if db_assignment.student_id:
        emit_role_events("student", "assignment.created", assignment_event, user_id=db_assignment.student_id)
    else:
        emit_role_events("student", "assignment.created", assignment_event)

    return db_assignment

@app.put("/assignments/{assignment_id}", response_model=schemas.Assignment)
def update_assignment(assignment_id: int, assignment: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if db_assignment is None: raise HTTPException(status_code=404)
    
    for key, value in assignment.model_dump().items(): 
        setattr(db_assignment, key, value)
    
    db.commit()
    db.refresh(db_assignment)
    
    created_notifications: List[models.Notification] = []

    # Notify students about the update
    if db_assignment.student_id:
        db_n = models.Notification(
            user_id=db_assignment.student_id,
            title="Vazifa o'zgartirildi",
            message=f"Sizning vazifangiz o'zgartirildi: {db_assignment.title}",
            type="assignment_updated",
            assignment_id=db_assignment.id
        )
        db.add(db_n)
        created_notifications.append(db_n)
    else:
        # Notify all students in course
        enrollments = db.query(models.CourseEnrollment).filter(
            models.CourseEnrollment.course_id == db_assignment.course_id
        ).all()
        for enrollment in enrollments:
            db_n = models.Notification(
                user_id=enrollment.student_id,
                title="Kurs vazifasi o'zgartirildi",
                message=f"Kurs vazifasi o'zgartirildi: {db_assignment.title}",
                type="assignment_updated",
                assignment_id=db_assignment.id
            )
            db.add(db_n)
            created_notifications.append(db_n)
    
    db.commit()

    for item in created_notifications:
        db.refresh(item)
        push_notification_realtime(item.user_id, notification_to_payload(item))
        emit_role_events(
            "student",
            "notification.created",
            {"notification_id": item.id, "user_id": item.user_id, "type": item.type},
            user_id=item.user_id,
        )
        student = db.query(models.Student).filter(models.Student.id == item.user_id).first()
        if student:
            send_telegram_to_student(student, f"Homework: {item.message}")

    update_event = {
        "assignment_id": db_assignment.id,
        "course_id": db_assignment.course_id,
        "teacher_id": db_assignment.teacher_id,
        "student_id": db_assignment.student_id,
        "title": db_assignment.title,
    }
    emit_role_events("teacher", "assignment.updated", update_event, user_id=db_assignment.teacher_id)
    if db_assignment.student_id:
        emit_role_events("student", "assignment.updated", update_event, user_id=db_assignment.student_id)
    else:
        emit_role_events("student", "assignment.updated", update_event)

    return db_assignment

@app.post("/assignments/{assignment_id}/submit")
def submit_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """Mark assignment as submitted by student"""
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if db_assignment is None: 
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    from datetime import datetime
    db_assignment.submitted = True
    db_assignment.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(db_assignment)
    
    # Notify teacher about submission
    if db_assignment.teacher_id:
        student = db.query(models.Student).filter(models.Student.id == db_assignment.student_id).first()
        student_name = student.name if student else "Unknown"
        db_n = models.Notification(
            user_id=db_assignment.teacher_id,
            title="Vazifa topshirildi",
            message=f"{student_name} vazifani topshirdi: {db_assignment.title}",
            type="assignment_submitted",
            assignment_id=db_assignment.id
        )
        db.add(db_n)
        db.commit()
    
    return db_assignment


@app.post("/assignments/{assignment_id}/status", response_model=schemas.AssignmentProgress)
def update_assignment_status(
    assignment_id: int,
    payload: schemas.AssignmentStatusUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
        if db_assignment is None:
            raise HTTPException(status_code=404, detail="Assignment not found")

        if payload.status not in ALLOWED_ASSIGNMENT_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")

        student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        if db_assignment.student_id is not None and db_assignment.student_id != payload.student_id:
            raise HTTPException(status_code=403, detail="Student is not assigned to this task")

        if db_assignment.student_id is None:
            enrollment = db.query(models.CourseEnrollment).filter(
                models.CourseEnrollment.student_id == payload.student_id,
                models.CourseEnrollment.course_id == db_assignment.course_id,
            ).first()
            if not enrollment:
                raise HTTPException(status_code=403, detail="Student is not enrolled in this course")

        progress = db.query(models.AssignmentProgress).filter(
            models.AssignmentProgress.assignment_id == assignment_id,
            models.AssignmentProgress.student_id == payload.student_id,
        ).first()

        now = datetime.utcnow()

        if progress is None:
            sync_table_id_sequence(db, "assignment_progress")
            progress = models.AssignmentProgress(
                assignment_id=assignment_id,
                teacher_id=db_assignment.teacher_id,
                student_id=payload.student_id,
                course_id=db_assignment.course_id,
                status=payload.status,
                seen_at=now,
                accepted_at=now if payload.status == "accepted" else None,
                in_progress_at=now if payload.status == "in_progress" else None,
                completed_at=now if payload.status == "completed" else None,
            )
            db.add(progress)
        else:
            progress.status = payload.status
            progress.seen_at = progress.seen_at or now
            if payload.status == "accepted" and progress.accepted_at is None:
                progress.accepted_at = now
            if payload.status == "in_progress" and progress.in_progress_at is None:
                progress.in_progress_at = now
            if payload.status == "completed" and progress.completed_at is None:
                progress.completed_at = now

        if payload.status == "accepted":
            db_assignment.submitted = True
            db_assignment.submitted_at = now

        sync_table_id_sequence(db, "notification")
        create_teacher_status_notification(
            db=db,
            teacher_id=db_assignment.teacher_id,
            assignment_id=db_assignment.id,
            assignment_title=db_assignment.title,
            student_name=student.name,
            status_value=payload.status,
        )

        try:
            db.commit()
        except IntegrityError as ie:
            db.rollback()
            sync_table_id_sequence(db, "notification")
            raise HTTPException(
                status_code=409,
                detail="Notification sequence out of sync. Please retry.",
            )

        db.refresh(progress)

        status_event = {
            "assignment_id": assignment_id,
            "student_id": payload.student_id,
            "teacher_id": db_assignment.teacher_id,
            "course_id": db_assignment.course_id,
            "status": payload.status,
            "progress_id": progress.id,
        }
        emit_role_events("teacher", "assignment.status_changed", status_event, user_id=db_assignment.teacher_id)
        emit_role_events("admin", "assignment.status_changed", status_event)
        emit_role_events("student", "assignment.status_changed", status_event, user_id=payload.student_id)

        return progress
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating assignment status: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/assignment-progress/", response_model=List[schemas.AssignmentProgress])
def get_assignment_progresses(student_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.AssignmentProgress)
    if student_id is not None:
        query = query.filter(models.AssignmentProgress.student_id == student_id)
    return query.order_by(models.AssignmentProgress.updated_at.desc()).all()


@app.get("/teacher/{teacher_id}/task-notifications")
def get_teacher_task_notifications(teacher_id: int, db: Session = Depends(get_db)):
    progresses = db.query(models.AssignmentProgress).filter(
        models.AssignmentProgress.teacher_id == teacher_id
    ).order_by(models.AssignmentProgress.updated_at.desc()).all()

    if not progresses:
        return {
            "accepted": [],
            "in_progress": [],
            "completed": [],
        }

    student_ids = list({p.student_id for p in progresses})
    assignment_ids = list({p.assignment_id for p in progresses})

    students = db.query(models.Student).filter(models.Student.id.in_(student_ids)).all()
    assignments = db.query(models.Assignment).filter(models.Assignment.id.in_(assignment_ids)).all()

    students_by_id = {s.id: s for s in students}
    assignments_by_id = {a.id: a for a in assignments}

    grouped = {
        "accepted": [],
        "in_progress": [],
        "completed": [],
    }

    for item in progresses:
        status_key = item.status if item.status in grouped else "accepted"
        student = students_by_id.get(item.student_id)
        assignment = assignments_by_id.get(item.assignment_id)
        grouped[status_key].append({
            "progress_id": item.id,
            "assignment_id": item.assignment_id,
            "assignment_title": assignment.title if assignment else "Vazifa",
            "student_id": item.student_id,
            "student_name": student.name if student else f"Student #{item.student_id}",
            "course_id": item.course_id,
            "status": item.status,
            "seen_at": item.seen_at,
            "accepted_at": item.accepted_at,
            "in_progress_at": item.in_progress_at,
            "completed_at": item.completed_at,
            "updated_at": item.updated_at,
        })

    return grouped

@app.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    db_assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if db_assignment is None: raise HTTPException(status_code=404)
    created_notifications: List[models.Notification] = []
    
    # Create notifications before deleting
    if db_assignment.student_id:
        db_n = models.Notification(
            user_id=db_assignment.student_id,
            title="Vazifa bekor qilindi",
            message=f"Sizning vazifangiz bekor qilindi: {db_assignment.title}",
            type="assignment_deleted",
            assignment_id=db_assignment.id
        )
        db.add(db_n)
        created_notifications.append(db_n)
    else:
        # Notify all students in course
        enrollments = db.query(models.CourseEnrollment).filter(
            models.CourseEnrollment.course_id == db_assignment.course_id
        ).all()
        for enrollment in enrollments:
            db_n = models.Notification(
                user_id=enrollment.student_id,
                title="Kurs vazifasi bekor qilindi",
                message=f"Kurs vazifasi bekor qilindi: {db_assignment.title}",
                type="assignment_deleted",
                assignment_id=db_assignment.id
            )
            db.add(db_n)
            created_notifications.append(db_n)
    
    db.delete(db_assignment)
    db.commit()

    for item in created_notifications:
        db.refresh(item)
        push_notification_realtime(item.user_id, notification_to_payload(item))
        emit_role_events(
            "student",
            "notification.created",
            {"notification_id": item.id, "user_id": item.user_id, "type": item.type},
            user_id=item.user_id,
        )
        student = db.query(models.Student).filter(models.Student.id == item.user_id).first()
        if student:
            send_telegram_to_student(student, f"Homework: {item.message}")

    return {"message": "Assignment deleted"}

