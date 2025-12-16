from fastapi import HTTPException
from database import get_connection
from schemas.car_schema import CarCreate, Detail

class CarService:

    def get_cars(self):
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM carlist")
            cars = cursor.fetchall()
            for car in cars:
                cursor.execute("SELECT * FROM details WHERE car_id=%s", (car['id'],))
                car['details'] = cursor.fetchall()
            return cars
        except Exception as e:
            print(e)
            raise HTTPException(status_code=404, detail="Cars not found")
        finally:
            cursor.close()
            conn.close()

    def create_car(self, car: CarCreate):
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO carlist (model, year, color) VALUES (%s, %s, %s) RETURNING *",
                (car.model, car.year, car.color)
            )
            created_car = cursor.fetchone()
            for d in car.details:
                cursor.execute(
                    "INSERT INTO details (name, car_id) VALUES (%s, %s)",
                    (d.name, created_car['id'])
                )
            conn.commit()
            return created_car
        except Exception as e:
            conn.rollback()
            print(e)
            raise HTTPException(status_code=400, detail="Car not created")
        finally:
            cursor.close()
            conn.close()

    def update_car(self, car_id: int, car: CarCreate):
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE carlist SET model=%s, year=%s, color=%s WHERE id=%s RETURNING *",
                (car.model, car.year, car.color, car_id)
            )
            updated_car = cursor.fetchone()
            if not updated_car:
                raise HTTPException(status_code=404, detail="Car not found")
            # Delete old details and add new ones
            cursor.execute("DELETE FROM details WHERE car_id=%s", (car_id,))
            for d in car.details:
                cursor.execute(
                    "INSERT INTO details (name, car_id) VALUES (%s, %s)",
                    (d.name, car_id)
                )
            conn.commit()
            return updated_car
        except Exception as e:
            conn.rollback()
            print(e)
            raise HTTPException(status_code=400, detail="Car not updated")
        finally:
            cursor.close()
            conn.close()

    def delete_car(self, car_id: int):
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM carlist WHERE id=%s RETURNING *", (car_id,))
            deleted = cursor.fetchone()
            if not deleted:
                raise HTTPException(status_code=404, detail="Car not found")
            conn.commit()
            return {"detail": "Car deleted"}
        except Exception as e:
            conn.rollback()
            print(e)
            raise HTTPException(status_code=400, detail="Car not deleted")
        finally:
            cursor.close()
            conn.close()
