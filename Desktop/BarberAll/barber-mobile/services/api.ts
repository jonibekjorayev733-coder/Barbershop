import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "https://barbershop-q8eb.onrender.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: string;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
}

export interface PhoneOtpRequestPayload {
  name?: string;
  phone: string;
}

export interface PhoneOtpSendResponseApi {
  success: boolean;
  phone: string;
  expires_in_seconds: number;
  delivery_status: string;
  debug_code?: string | null;
  message?: string | null;
}

export interface PhoneOtpVerifyPayload {
  name?: string;
  phone: string;
  code: string;
}

export interface UserBookingBarberApi {
  id: number;
  name: string;
  specialty: string;
  work_directions?: string | null;
  rating: number;
  years_experience: number;
  photo_url?: string | null;
  bio?: string | null;
  phone?: string | null;
  total_cuts?: number;
  status?: string;
  service_price?: number;
  discount_percent?: number;
  distance_km?: number | null;
  barbershop_name?: string | null;
  barbershop_address?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
}

export interface BarberAvailabilitySlotApi {
  time: string;
  status: "available" | "booked";
}

export interface BarberAvailabilityApi {
  barber_id: number;
  barber_name: string;
  date: string;
  slots: BarberAvailabilitySlotApi[];
}

export interface UserBookingCreatePayload {
  barber_id: number;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  client_phone: string;
  service_name?: string;
  user_id?: number;
}

export interface UserBookingConfirmationApi {
  booking_id: string;
  appointment_id: number;
  barber_id: number;
  barber_name: string;
  barber_specialty: string;
  barber_photo_url?: string | null;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  client_phone: string;
  service_name?: string | null;
  service_price?: number | null;
  discount_percent?: number;
  status: "pending" | "completed" | "cancelled";
}

export interface UserAppointmentApi {
  id: number;
  barber_id: number;
  barber_name?: string;
  barber_photo_url?: string | null;
  barber_specialty?: string;
  appointment_date: string;
  appointment_time: string;
  client_name: string;
  client_phone: string;
  service_name?: string | null;
  service_price?: number | null;
  status: "pending" | "completed" | "cancelled";
  created_at?: string;
}

export interface UserProfileApi {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
}

export interface AdminBookingApi {
  id: string;
  client: string;
  phone: string;
  barber: string;
  service: string;
  price: number;
  time: string;
  date: string;
  status: "pending" | "completed" | "cancelled";
}

export interface AdminProfileApi {
  id: number;
  email: string;
  name: string;
  phone?: string | null;
  avatar?: string | null;
}

export interface AdminProfileUpdatePayload {
  email: string;
  name: string;
  phone?: string;
  password?: string;
  avatar?: string;
}

export interface UserNotificationApi {
  id: number;
  type: string;
  title: string;
  message: string;
  barber_id?: number | null;
  appointment_id?: number | null;
  sms_sent: boolean;
  voice_sent: boolean;
  is_read: boolean;
  created_at?: string | null;
}

export interface BarberAppointmentApi {
  id: number;
  barber_id: number;
  student_id?: number | null;
  client_name: string;
  client_phone: string;
  appointment_date: string;
  appointment_time: string;
  status: "pending" | "accepted" | "rejected" | "completed" | "rated" | "cancelled";
  user_rating?: number | null;
  user_rated_at?: string | null;
  service_name?: string | null;
}


export type BarberApiStatus = "available" | "busy" | "off";

export interface AdminBarberApi {
  id: number;
  name: string;
  specialty: string;
  phone: string;
  rating: number;
  total_cuts: number;
  today_cuts: number;
  status: BarberApiStatus;
  color: string;
  gradient: string;
  photo_url?: string | null;
  years_experience?: number;
  username?: string;
  bio?: string | null;
}

export interface AdminBarberUpdatePayload {
  name: string;
  specialty: string;
  phone: string;
  rating: number;
  total_cuts: number;
  today_cuts: number;
  status: BarberApiStatus;
  photo_url?: string | null;
  years_experience?: number;
  username?: string;
  password?: string;
  bio?: string | null;
}

export interface AdminBarberCreatePayload {
  name: string;
  specialty: string;
  phone: string;
  rating?: number;
  total_cuts?: number;
  today_cuts?: number;
  status?: BarberApiStatus;
  photo_url?: string | null;
  years_experience?: number;
  username: string;
  password: string;
  bio?: string | null;
}

export interface BarberRatingPayload {
  score: number;
  user_name?: string;
  comment?: string;
}

export interface BarberRatingResponseApi {
  barber_id: number;
  rating: number;
  rating_votes: number;
}

export interface BarberAppointmentApi {
  id: number;
  barber_id: number;
  client_name: string;
  client_phone: string;
  appointment_time: string;
  appointment_date: string;
  status: "pending" | "completed" | "cancelled";
  service_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BarberDashboardApi {
  barber_id: number;
  barber_name: string;
  today_total: number;
  today_done: number;
  today_pending: number;
  progress_ratio: number;
  next_appointment?: BarberAppointmentApi | null;
  today_appointments: BarberAppointmentApi[];
}

export interface BarberNotificationApi {
  id: number;
  barber_id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at?: string;
}

export interface BarberProfileApi {
  id: number;
  name: string;
  email: string;
  photo_url?: string | null;
  specialty?: string;
  work_directions?: string | null;
  service_price?: number | null;
  discount_percent?: number | null;
  location_address?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
}

export interface BarberProfileUpdatePayload {
  name: string;
  email: string;
  password?: string;
  photo_url?: string | null;
  specialty?: string;
  work_directions?: string;
  service_price?: number;
  discount_percent?: number;
  location_address?: string;
  location_latitude?: number;
  location_longitude?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("access_token");
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
  config?: { timeoutMs?: number }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const timeoutMs = config?.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Server javobi sekin. Qayta urinib ko'ring (backend uyg'onayotgan bo'lishi mumkin).");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      const message = parsed?.detail || parsed?.message || raw;
      throw new Error(message || `HTTP ${res.status}`);
    } catch {
      throw new Error(raw || `HTTP ${res.status}`);
    }
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

function isLikelySlowBackendError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("sekin") || message.includes("timeout") || message.includes("timed out");
}

async function runAuthRequestWithRetry<T>(
  run: (timeoutMs: number) => Promise<T>,
): Promise<T> {
  try {
    return await run(7000);
  } catch (firstError: unknown) {
    if (!isLikelySlowBackendError(firstError)) {
      throw firstError;
    }

    await warmupServer();
    return run(30000);
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  return runAuthRequestWithRetry((timeoutMs) =>
    fetchApi<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password: password.trim() }),
    }, false, { timeoutMs })
  );
}

export async function requestPhoneOtp(payload: PhoneOtpRequestPayload): Promise<PhoneOtpSendResponseApi> {
  return runAuthRequestWithRetry((timeoutMs) =>
    fetchApi<PhoneOtpSendResponseApi>("/auth/phone/request", {
      method: "POST",
      body: JSON.stringify(payload),
    }, false, { timeoutMs })
  );
}

export async function verifyPhoneOtp(payload: PhoneOtpVerifyPayload): Promise<LoginResponse> {
  return runAuthRequestWithRetry((timeoutMs) =>
    fetchApi<LoginResponse>("/auth/phone/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }, false, { timeoutMs })
  );
}

export async function registerUser(name: string, email: string, password: string): Promise<LoginResponse> {
  return runAuthRequestWithRetry((timeoutMs) =>
    fetchApi<LoginResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }, false, { timeoutMs })
  );
}

export async function warmupServer(): Promise<void> {
  try {
    await fetchApi<string>("/", {}, false, { timeoutMs: 8000 });
  } catch {
    return;
  }
}

// ─── Barbers ───────────────────────────────────────────────────────────────────

export async function getBarbers(params?: {
  lat?: number;
  lng?: number;
  maxDistanceKm?: number;
  nearOnly?: boolean;
}): Promise<UserBookingBarberApi[]> {
  const query = new URLSearchParams();
  if (typeof params?.lat === "number") {
    query.set("lat", String(params.lat));
  }
  if (typeof params?.lng === "number") {
    query.set("lng", String(params.lng));
  }
  if (typeof params?.maxDistanceKm === "number") {
    query.set("max_distance_km", String(params.maxDistanceKm));
  }
  if (typeof params?.nearOnly === "boolean") {
    query.set("near_only", String(params.nearOnly));
  }
  const qs = query.toString();
  return fetchApi<UserBookingBarberApi[]>(`/user/barbers${qs ? `?${qs}` : ""}`);
}

export async function getBarberAvailability(
  barberId: number,
  date: string
): Promise<BarberAvailabilityApi> {
  return fetchApi<BarberAvailabilityApi>(
    `/user/barbers/${barberId}/availability?date=${encodeURIComponent(date)}`
  );
}

// ─── Booking ───────────────────────────────────────────────────────────────────

export async function createBooking(
  payload: UserBookingCreatePayload
): Promise<UserBookingConfirmationApi> {
  return fetchApi<UserBookingConfirmationApi>("/user/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── User appointments ─────────────────────────────────────────────────────────

export async function getUserAppointments(userId: number): Promise<UserAppointmentApi[]> {
  const rows = await fetchApi<Array<{
    id: string;
    client: string;
    phone: string;
    barber: string;
    service: string;
    price: number;
    time: string;
    date: string;
    status: "pending" | "completed" | "cancelled";
  }>>("/bookings/");

  return rows
    .filter((item) => item.id)
    .map((item) => ({
      id: Number(String(item.id).replace(/\D/g, "") || 0),
      barber_id: 0,
      barber_name: item.barber,
      barber_specialty: item.service,
      appointment_date: item.date,
      appointment_time: item.time,
      client_name: item.client,
      client_phone: item.phone,
      service_name: item.service,
      service_price: item.price,
      status: item.status,
    }));
}

// ─── User profile ──────────────────────────────────────────────────────────────

export async function getUserProfile(userId: number): Promise<UserProfileApi> {
  return fetchApi<UserProfileApi>(`/students/${userId}/profile`);
}

export async function updateUserProfile(
  userId: number,
  payload: Partial<UserProfileApi & { password?: string }>
): Promise<UserProfileApi> {
  return fetchApi<UserProfileApi>(`/students/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getBookings(options?: {
  date?: string;
  status?: "all" | "pending" | "completed" | "cancelled";
}): Promise<AdminBookingApi[]> {
  const query = new URLSearchParams();
  if (options?.date) {
    query.set("date", options.date);
  }
  if (options?.status) {
    query.set("status_filter", options.status);
  }
  const qs = query.toString();
  return fetchApi<AdminBookingApi[]>(`/bookings/${qs ? `?${qs}` : ""}`);
}

export async function getAdminBarbers(): Promise<AdminBarberApi[]> {
  return fetchApi<AdminBarberApi[]>("/barbers/");
}

export async function getAdminProfile(adminId: number): Promise<AdminProfileApi> {
  return fetchApi<AdminProfileApi>(`/admins/${adminId}`);
}

export async function updateAdminProfile(adminId: number, payload: AdminProfileUpdatePayload): Promise<AdminProfileApi> {
  return fetchApi<AdminProfileApi>(`/admins/${adminId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBarber(
  barberId: number,
  payload: AdminBarberUpdatePayload
): Promise<AdminBarberApi> {
  return fetchApi<AdminBarberApi>(`/barbers/${barberId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function createAdminBarber(
  payload: AdminBarberCreatePayload
): Promise<AdminBarberApi> {
  return fetchApi<AdminBarberApi>("/barbers/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBarber(barberId: number): Promise<void> {
  return fetchApi<void>(`/barbers/${barberId}`, {
    method: "DELETE",
  });
}

export async function getBarberDashboard(barberId: number): Promise<BarberDashboardApi> {
  return fetchApi<BarberDashboardApi>(`/barbers/${barberId}/dashboard`);
}

export async function getBarberAppointments(
  barberId: number,
  options?: { status?: "all" | "pending" | "completed"; date?: string }
): Promise<BarberAppointmentApi[]> {
  const query = new URLSearchParams();
  if (options?.status) {
    query.set("status_filter", options.status);
  }
  if (options?.date) {
    query.set("date", options.date);
  }
  const qs = query.toString();
  return fetchApi<BarberAppointmentApi[]>(`/barbers/${barberId}/appointments${qs ? `?${qs}` : ""}`);
}

export async function completeBarberAppointment(barberId: number, appointmentId: number): Promise<BarberAppointmentApi> {
  return fetchApi<BarberAppointmentApi>(`/barbers/${barberId}/appointments/${appointmentId}/complete`, {
    method: "PATCH",
  });
}

export async function approveBarberAppointment(barberId: number, appointmentId: number): Promise<BarberAppointmentApi> {
  return fetchApi<BarberAppointmentApi>(`/barbers/${barberId}/appointments/${appointmentId}/approve`, {
    method: "PATCH",
  });
}

export async function rejectBarberAppointment(barberId: number, appointmentId: number): Promise<BarberAppointmentApi> {
  return fetchApi<BarberAppointmentApi>(`/barbers/${barberId}/appointments/${appointmentId}/reject`, {
    method: "PATCH",
  });
}

export async function getBarberNotifications(barberId: number): Promise<BarberNotificationApi[]> {
  return fetchApi<BarberNotificationApi[]>(`/barbers/${barberId}/notifications`);
}

export async function acceptBarberAppointment(barberId: number, appointmentId: number): Promise<BarberAppointmentApi> {
  return fetchApi<BarberAppointmentApi>(`/barbers/${barberId}/appointments/${appointmentId}/accept`, {
    method: "PATCH",
  });
}

export async function rateAppointment(appointmentId: number, rating: number): Promise<{ success: boolean; rating: number; appointment_id: number }> {
  return fetchApi<{ success: boolean; rating: number; appointment_id: number }>(`/appointments/${appointmentId}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

export async function getUserNotifications(): Promise<UserNotificationApi[]> {
  return fetchApi<UserNotificationApi[]>("/user/notifications");
}

export async function markNotificationRead(notificationId: number): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/user/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function markBarberNotificationRead(barberId: number, notificationId: number): Promise<BarberNotificationApi> {
  return fetchApi<BarberNotificationApi>(`/barbers/${barberId}/notifications/${notificationId}/read`, {
    method: "PUT",
  });
}

export async function getBarberProfile(barberId: number): Promise<BarberProfileApi> {
  return fetchApi<BarberProfileApi>(`/barbers/${barberId}/profile`);
}

export async function updateBarberProfile(barberId: number, payload: BarberProfileUpdatePayload): Promise<BarberProfileApi> {
  return fetchApi<BarberProfileApi>(`/barbers/${barberId}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function submitBarberRating(
  barberId: number,
  payload: BarberRatingPayload
): Promise<BarberRatingResponseApi> {
  return fetchApi<BarberRatingResponseApi>(`/barbers/${barberId}/ratings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
