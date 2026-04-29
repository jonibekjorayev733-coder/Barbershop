from sqlalchemy import Column, Integer, String, Float, JSON, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from zoneinfo import ZoneInfo
try:
    from database import Base
except ImportError:
    from .database import Base


TASHKENT_TZ = ZoneInfo("Asia/Tashkent")


def tashkent_now() -> datetime:
    return datetime.now(TASHKENT_TZ).replace(tzinfo=None)

class Admin(Base):
    __tablename__ = "admin"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    name = Column(String)
    avatar = Column(String, nullable=True)
    role = Column(String, default="admin")

class Teacher(Base):
    __tablename__ = "teacher"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)  # hashed password
    avatar = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    role = Column(String, default="teacher")
    
    # Relationships
    courses = relationship("Course", back_populates="teacher")
    assignments = relationship("Assignment", back_populates="teacher", foreign_keys="Assignment.teacher_id")


class Barber(Base):
    __tablename__ = "barber"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    specialty = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    rating = Column(Float, default=4.8)
    rating_votes = Column(Integer, default=0)
    total_cuts = Column(Integer, default=0)
    today_cuts = Column(Integer, default=0)
    status = Column(String, default="available")
    color = Column(String, default="#818cf8")
    gradient = Column(String, default="linear-gradient(135deg,#6366f1,#818cf8)")
    photo_url = Column(String, nullable=True)
    years_experience = Column(Integer, default=1)
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)
    role = Column(String, default="barber")
    bio = Column(String, nullable=True)
    work_directions = Column(String, nullable=True)
    service_price = Column(Float, default=40000)
    discount_percent = Column(Float, default=0)
    barbershop_id = Column(Integer, ForeignKey("barbershop.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=tashkent_now)
    updated_at = Column(DateTime, default=tashkent_now, onupdate=tashkent_now)

    barbershop = relationship("Barbershop", back_populates="barbers")


class Barbershop(Base):
    __tablename__ = "barbershop"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    address = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    photo_url = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=tashkent_now)
    updated_at = Column(DateTime, default=tashkent_now, onupdate=tashkent_now)

    barbers = relationship("Barber", back_populates="barbershop")


class BarberAppointment(Base):
    __tablename__ = "barber_appointment"

    id = Column(Integer, primary_key=True, index=True)
    barber_id = Column(Integer, ForeignKey("barber.id"), nullable=False, index=True)
    client_name = Column(String, nullable=False)
    client_phone = Column(String, nullable=False)
    appointment_time = Column(String, nullable=False)
    appointment_date = Column(String, nullable=False, index=True)
    status = Column(String, default="pending")
    service_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=tashkent_now)
    updated_at = Column(DateTime, default=tashkent_now, onupdate=tashkent_now)

class Student(Base):
    __tablename__ = "student"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)  # hashed password
    avatar = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    telegram = Column(String, nullable=True)
    role = Column(String, default="student")
    telegram_chat_id = Column(String, nullable=True, index=True)
    telegram_linked_at = Column(DateTime, nullable=True)
    
    # Relationships
    courses = relationship("CourseEnrollment", back_populates="student")
    assignments = relationship("Assignment", back_populates="student", foreign_keys="Assignment.student_id")

class Course(Base):
    __tablename__ = "course"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    instructor = Column(String)
    price = Column(Float)
    duration = Column(String)
    level = Column(String)
    image_url = Column(String, nullable=True)
    color = Column(String)
    syllabus = Column(JSON)
    completed_lessons = Column(Integer, default=0)
    total_lessons = Column(Integer, default=12)
    teacher_id = Column(Integer, ForeignKey("teacher.id"), nullable=True)
    created_at = Column(DateTime, default=tashkent_now)
    
    # Relationships
    teacher = relationship("Teacher", back_populates="courses")
    enrollments = relationship("CourseEnrollment", back_populates="course")
    lessons = relationship("Lesson", back_populates="course")
    assignments = relationship("Assignment", back_populates="course")

class Lesson(Base):
    __tablename__ = "lesson"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("course.id"), nullable=False, index=True)
    topic = Column(String, nullable=False)
    created_at = Column(DateTime, default=tashkent_now)
    attendance_saved = Column(Boolean, default=False)
    attendance_edit_used = Column(Boolean, default=False)

    course = relationship("Course", back_populates="lessons")
    attendance_records = relationship("Attendance", back_populates="lesson")

class CourseEnrollment(Base):
    __tablename__ = "course_enrollment"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student.id"))
    course_id = Column(Integer, ForeignKey("course.id"))
    enrolled_at = Column(DateTime, default=tashkent_now)
    
    # Relationships
    student = relationship("Student", back_populates="courses")
    course = relationship("Course", back_populates="enrollments")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    course_id = Column(Integer)
    lesson_id = Column(Integer, ForeignKey("lesson.id"), nullable=True)
    date = Column(String)
    status = Column(String)
    penalty_hours = Column(Integer, nullable=True)
    late_minutes = Column(Integer, nullable=True)
    grade = Column(Float, nullable=True)

    lesson = relationship("Lesson", back_populates="attendance_records")

class Performance(Base):
    __tablename__ = "performance"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer)
    course_id = Column(Integer)
    date = Column(String)
    score = Column(Float)
    type = Column(String)
    label = Column(String)

class Payment(Base):
    __tablename__ = "payment"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student.id"))
    course_id = Column(Integer, ForeignKey("course.id"))
    amount = Column(Float)
    currency = Column(String, default="USD")
    status = Column(String, default="pending")  # pending, paid, failed
    payment_method = Column(String, nullable=True)  # card, uzum, click, payme
    payment_details = Column(JSON, nullable=True)  # card_last4, transaction_id, etc.
    due_date = Column(String)
    paid_date = Column(String, nullable=True)
    month = Column(String)
    card_last4 = Column(String, nullable=True)
    created_at = Column(DateTime, default=tashkent_now)
    updated_at = Column(DateTime, default=tashkent_now, onupdate=tashkent_now)
    
    # Relationships
    student = relationship("Student")
    course = relationship("Course")

class Notification(Base):
    __tablename__ = "notification"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    title = Column(String)
    message = Column(String)
    type = Column(String)  # "assignment_created", "assignment_updated", "assignment_deleted", "assignment_submitted"
    assignment_id = Column(Integer, ForeignKey("assignment.id"), nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=tashkent_now)

class Assignment(Base):
    __tablename__ = "assignment"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    course_id = Column(Integer, ForeignKey("course.id"))
    teacher_id = Column(Integer, ForeignKey("teacher.id"))
    student_id = Column(Integer, ForeignKey("student.id"), nullable=True)  # null = full course task
    submitted = Column(Boolean, default=False)  # Track if assignment was accepted/submitted
    submitted_at = Column(DateTime, nullable=True)  # When student accepted the assignment
    created_at = Column(DateTime, default=tashkent_now)
    updated_at = Column(DateTime, default=tashkent_now, onupdate=tashkent_now)
    
    # Relationships
    course = relationship("Course", back_populates="assignments")
    teacher = relationship("Teacher", back_populates="assignments", foreign_keys=[teacher_id])
    student = relationship("Student", back_populates="assignments", foreign_keys=[student_id])




class TelegramLinkToken(Base):
    __tablename__ = "telegram_link_token"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=False, index=True)
    phone = Column(String, nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    chat_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AssignmentProgress(Base):
    __tablename__ = "assignment_progress"
    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", name="uq_assignment_progress_assignment_student"),
    )

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignment.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teacher.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("course.id"), nullable=False)
    status = Column(String, default="accepted")  # accepted, in_progress, completed
    seen_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    in_progress_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
