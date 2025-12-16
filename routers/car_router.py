# from fastapi import APIRouter, HTTPException
# from database import get_connection
# from schemas.car_schema import CarCreate
# from typing import Optional
#
# router = APIRouter(prefix="/cars", tags=["Cars"])
#
# # --- GET all cars ---
# @router.get("/")
# def get_cars():
#     conn = get_connection()
#     cur = conn.cursor()
#     cur.execute("""
#         SELECT c.id, c.model, c.year, c.color, json_agg(d.name) AS details
#         FROM carlist c
#         LEFT JOIN details d ON c.id = d.car_id
#         GROUP BY c.id
#         ORDER BY c.id DESC
#     """)
#     data = cur.fetchall()
#     cur.close()
#     conn.close()
#     return data
#
# # --- CREATE car ---
# @router.post("/")
# def create_car(car: CarCreate):
#     conn = get_connection()
#     cur = conn.cursor()
#     try:
#         cur.execute(
#             "INSERT INTO carlist (model, year, color) VALUES (%s, %s, %s) RETURNING id",
#             (car.model, car.year, car.color)
#         )
#         car_id = cur.fetchone()["id"]
#         if car.details:
#             cur.execute(
#                 "INSERT INTO details (name, car_id) VALUES (%s, %s)",
#                 (car.details, car_id)
#             )
#         conn.commit()
#         return {"id": car_id, "model": car.model, "year": car.year, "color": car.color, "details": car.details}
#     except Exception as e:
#         conn.rollback()
#         raise HTTPException(status_code=400, detail=str(e))
#     finally:
#         cur.close()
#         conn.close()
#
# # --- DELETE car ---
#
#
#
# @router.delete("/{car_id}")
# def delete_car(car_id: int):
#     conn = get_connection()
#     cur = conn.cursor()
#     # Avvalo details yozuvlarini o‘chir
#     cur.execute("DELETE FROM details WHERE car_id=%s", (car_id,))
#     # Keyin carlist yozuvini o‘chir
#     cur.execute("DELETE FROM carlist WHERE id=%s", (car_id,))
#     conn.commit()
#     cur.close()
#     conn.close()
#     return {"detail": f"Car {car_id} deleted"}
#
# # --- UPDATE car ---
# @router.put("/{car_id}")
# def update_car(car_id: int, car: CarCreate):
#     conn = get_connection()
#     cur = conn.cursor()
#     try:
#         # Car mavjudligini tekshiramiz
#         cur.execute("SELECT id FROM carlist WHERE id=%s", (car_id,))
#         if not cur.fetchone():
#             raise HTTPException(status_code=404, detail="Car not found")
#
#         # carlist update (ASOSIY TUZATISH SHU YERDA )
#         cur.execute(
#             "UPDATE carlist SET model=%s, year=%s, color=%s WHERE id=%s",
#             (car.model, car.year, car.color, car_id)
#         )
#
#         #  details yangilash
#         cur.execute("DELETE FROM details WHERE car_id=%s", (car_id,))
#         if car.details:
#             cur.execute(
#                 "INSERT INTO details (name, car_id) VALUES (%s, %s)",
#                 (car.details, car_id)
#             )
#
#         conn.commit()
#         return {
#             "id": car_id,
#             "model": car.model,
#             "year": car.year,
#             "color": car.color,
#             "details": car.details
#         }
#
#     except HTTPException:
#         raise
#     except Exception as e:
#         conn.rollback()
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         cur.close()
#         conn.close()


from fastapi import APIRouter, HTTPException, Query
from database import get_connection
from schemas.car_schema import CarCreate
from typing import Optional

router = APIRouter(prefix="/cars", tags=["Cars"])


# --- GET all cars OR search by model ---
@router.get("/")
def get_cars(search: Optional[str] = Query(None, description="Search car by model")):
    conn = get_connection()
    cur = conn.cursor()

    if search:
        cur.execute("""
                    SELECT c.id, c.model, c.year, c.color, json_agg(d.name) AS details
                    FROM carlist c
                             LEFT JOIN details d ON c.id = d.car_id
                    WHERE c.model ILIKE %s
                    GROUP BY c.id
                    ORDER BY c.id DESC
                    """, (f"%{search}%",))
    else:
        cur.execute("""
                    SELECT c.id, c.model, c.year, c.color, json_agg(d.name) AS details
                    FROM carlist c
                             LEFT JOIN details d ON c.id = d.car_id
                    GROUP BY c.id
                    ORDER BY c.id DESC
                    """)

    data = cur.fetchall()
    cur.close()
    conn.close()
    return data


# --- CREATE car ---
@router.post("/")
def create_car(car: CarCreate):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO carlist (model, year, color) VALUES (%s, %s, %s) RETURNING id",
            (car.model, car.year, car.color)
        )
        car_id = cur.fetchone()["id"]
        if car.details:
            cur.execute(
                "INSERT INTO details (name, car_id) VALUES (%s, %s)",
                (car.details, car_id)
            )
        conn.commit()
        return {"id": car_id, "model": car.model, "year": car.year, "color": car.color, "details": car.details}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cur.close()
        conn.close()


# --- DELETE car ---
@router.delete("/{car_id}")
def delete_car(car_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM details WHERE car_id=%s", (car_id,))
        cur.execute("DELETE FROM carlist WHERE id=%s", (car_id,))
        conn.commit()
        return {"detail": f"Car {car_id} deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


# --- UPDATE car ---
@router.put("/{car_id}")
def update_car(car_id: int, car: CarCreate):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM carlist WHERE id=%s", (car_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Car not found")

        cur.execute(
            "UPDATE carlist SET model=%s, year=%s, color=%s WHERE id=%s",
            (car.model, car.year, car.color, car_id)
        )

        cur.execute("DELETE FROM details WHERE car_id=%s", (car_id,))
        if car.details:
            cur.execute(
                "INSERT INTO details (name, car_id) VALUES (%s, %s)",
                (car.details, car_id)
            )

        conn.commit()
        return {"id": car_id, "model": car.model, "year": car.year, "color": car.color, "details": car.details}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
