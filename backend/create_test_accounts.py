from backend.database import SessionLocal
from backend.models import Teacher, Student
from backend.auth import hash_password

db = SessionLocal()

# Create test teacher
teacher = Teacher(
    name="Mr. Ahad",
    email="teacher@test.com",
    password=hash_password("teacher123"),
    subject="Matematika"
)
db.add(teacher)

# Create test student
student = Student(
    name="Jonibek",
    email="student@test.com",
    password=hash_password("student123"),
    phone="998901234567",
    telegram="@jonibek"
)
db.add(student)

db.commit()
db.close()
print("✅ Test accounts created")
