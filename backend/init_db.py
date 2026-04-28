import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys
import os

# Set UTF-8 encoding for Python
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def create_database():
    """Create PostgreSQL database if it doesn't exist"""
    try:
        # Connect to PostgreSQL default database
        con = psycopg2.connect(
            dbname='postgres',
            user='postgres',
            host='localhost',
            password='jonibek'
        )
        con.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = con.cursor()
        
        # Check if database exists
        cur.execute('SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s', ('course',))
        exists = cur.fetchone()
        
        if not exists:
            cur.execute('CREATE DATABASE course')
            print("✅ PostgreSQL database 'course' created successfully.")
        else:
            print("✅ PostgreSQL database 'course' already exists.")
        
        cur.close()
        con.close()
        
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False
    
    return True

if __name__ == "__main__":
    if create_database():
        print("\n📊 Now running database migrations...")
        try:
            from backend.database import engine
            from backend.models import Base
            
            # Create all tables
            Base.metadata.create_all(bind=engine)
            print("✅ Database tables created successfully!")
            print("\n🔐 Creating test data...")
            
            # Create test data
            from backend.database import SessionLocal
            from backend.models import Admin, Teacher, Student
            from backend.auth import hash_password
            
            db = SessionLocal()
            
            # Check if admin exists
            admin = db.query(Admin).filter(Admin.email == "admin@test.com").first()
            if not admin:
                admin = Admin(
                    name="Admin User",
                    email="admin@test.com",
                    password=hash_password("admin123")
                )
                db.add(admin)
                print("✅ Admin created: admin@test.com / admin123")
            
            # Check if teacher exists
            teacher = db.query(Teacher).filter(Teacher.email == "teacher@test.com").first()
            if not teacher:
                teacher = Teacher(
                    name="Mr. Ahad",
                    email="teacher@test.com",
                    password=hash_password("teacher123"),
                    subject="Matematika"
                )
                db.add(teacher)
                print("✅ Teacher created: teacher@test.com / teacher123")
            
            # Check if student exists
            student = db.query(Student).filter(Student.email == "student@test.com").first()
            if not student:
                student = Student(
                    name="Jonibek",
                    email="student@test.com",
                    password=hash_password("student123"),
                    phone="998901234567",
                    telegram="@jonibek"
                )
                db.add(student)
                print("OK Student created: student@test.com / student123")
            
            # Add more test students
            test_students = [
                {"name": "Ahmadjon Rahimov", "email": "ahmadjon@test.com", "phone": "998901111111"},
                {"name": "Bekzod Karimov", "email": "bekzod@test.com", "phone": "998902222222"},
                {"name": "Dilshod Abdullayev", "email": "dilshod@test.com", "phone": "998903333333"},
                {"name": "Elyor Mirzaev", "email": "elyor@test.com", "phone": "998904444444"},
                {"name": "Farrux Aliyev", "email": "farrux@test.com", "phone": "998905555555"},
            ]
            
            for s in test_students:
                existing_student = db.query(Student).filter(Student.email == s['email']).first()
                if not existing_student:
                    new_student = Student(
                        name=s['name'],
                        email=s['email'],
                        password=hash_password("password123"),
                        phone=s['phone'],
                        telegram=f"@{s['name'].lower().replace(' ', '')}"
                    )
                    db.add(new_student)
                    print(f"OK Added student: {s['name']}")
            
            db.commit()
            db.close()
            
            print("\n🎉 Database initialization complete!")
            
        except Exception as e:
            print(f"❌ Error during migrations: {e}")
            import traceback
            traceback.print_exc()



