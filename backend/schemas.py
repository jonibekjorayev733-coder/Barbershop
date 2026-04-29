from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class AdminBase(BaseModel):
    email: str
    name: str
    avatar: Optional[str] = None

class AdminCreate(BaseModel):
    email: str
    password: str
    name: str
    avatar: Optional[str] = None


class AdminUpdate(BaseModel):
    email: str
    name: str
    password: Optional[str] = None
    avatar: Optional[str] = None

class Admin(AdminBase):
    id: int
    class Config: from_attributes = True


class BarberProfileUpdate(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    photo_url: Optional[str] = None


class BarberProfile(BaseModel):
    id: int
    name: str
    email: str
    photo_url: Optional[str] = None
    class Config: from_attributes = True

class TeacherBase(BaseModel):
    name: str
    email: str
    avatar: Optional[str] = None
    subject: Optional[str] = None

class TeacherCreate(BaseModel):
    name: str
    email: str
    password: str
    avatar: Optional[str] = None
    subject: Optional[str] = None

class TeacherUpdate(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    avatar: Optional[str] = None
    subject: Optional[str] = None

class Teacher(TeacherBase):
    id: int
    class Config: from_attributes = True


class BarberBase(BaseModel):
    name: str
    specialty: str
    phone: str
    rating: float = 4.8
    total_cuts: int = 0
    today_cuts: int = 0
    status: str = "available"
    color: str = "#818cf8"
    gradient: str = "linear-gradient(135deg,#6366f1,#818cf8)"
    photo_url: Optional[str] = None
    years_experience: int = 1
    username: Optional[str] = None
    bio: Optional[str] = None


class BarberCreate(BarberBase):
    password: str


class BarberUpdate(BarberBase):
    password: Optional[str] = None


class Barber(BarberBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True


class BarberAppointmentBase(BaseModel):
    client_name: str
    client_phone: str
    appointment_time: str
    appointment_date: str
    status: str = "pending"
    service_name: Optional[str] = None


class BarberAppointmentCreate(BarberAppointmentBase):
    barber_id: int


class BarberAppointment(BarberAppointmentBase):
    id: int
    barber_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True


class BarberDashboardResponse(BaseModel):
    barber_id: int
    barber_name: str
    today_total: int
    today_done: int
    today_pending: int
    progress_ratio: float
    next_appointment: Optional[BarberAppointment] = None
    today_appointments: List[BarberAppointment] = []


class UserBookingBarber(BaseModel):
    id: int
    name: str
    specialty: str
    rating: float
    years_experience: int
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    total_cuts: Optional[int] = 0
    status: Optional[str] = "available"
    color: Optional[str] = None


class TimeSlotAvailability(BaseModel):
    time: str
    status: str  # available | booked


class BarberAvailabilityResponse(BaseModel):
    barber_id: int
    barber_name: str
    date: str
    slots: List[TimeSlotAvailability]


class UserBookingCreateRequest(BaseModel):
    barber_id: int
    appointment_date: str
    appointment_time: str
    client_name: str
    client_phone: str
    service_name: Optional[str] = None
    user_id: Optional[int] = None


class UserBookingConfirmation(BaseModel):
    booking_id: str
    appointment_id: int
    barber_id: int
    barber_name: str
    barber_specialty: str
    barber_photo_url: Optional[str] = None
    appointment_date: str
    appointment_time: str
    client_name: str
    client_phone: str
    service_name: Optional[str] = None
    status: str


class AdminBookingRow(BaseModel):
    id: str
    client: str
    phone: str
    barber: str
    service: str
    price: float
    time: str
    date: str
    status: str

class StudentBase(BaseModel):
    name: str
    email: str
    avatar: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_linked_at: Optional[datetime] = None

class StudentCreate(BaseModel):
    name: str
    email: str
    password: str
    avatar: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None

class Student(StudentBase):
    id: int
    class Config: from_attributes = True


class StudentProfileUpdate(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    avatar: Optional[str] = None


class StudentProfile(BaseModel):
    id: int
    name: str
    email: str
    avatar: Optional[str] = None
    class Config: from_attributes = True

class StudentPasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class TelegramLinkRequest(BaseModel):
    phone: str


class TelegramLinkResponse(BaseModel):
    student_id: int
    student_name: str
    phone: str
    deep_link: str
    qr_payload: str
    expires_at: datetime


class CourseBase(BaseModel):
    name: str
    description: str
    instructor: str
    price: float
    duration: str
    level: str
    image_url: Optional[str] = None
    color: Optional[str] = "blue"
    syllabus: List[str] = []
    completed_lessons: int = 0
    total_lessons: int = 12
    teacher_id: Optional[int] = None

class CourseCreate(CourseBase): 
    pass

class Course(CourseBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class CourseEnrollmentBase(BaseModel):
    student_id: int
    course_id: int

class CourseEnrollmentCreate(CourseEnrollmentBase):
    pass

class CourseEnrollment(CourseEnrollmentBase):
    id: int
    enrolled_at: Optional[datetime] = None
    class Config: from_attributes = True

class LessonBase(BaseModel):
    course_id: int
    topic: str

class LessonCreate(LessonBase):
    lesson_datetime: Optional[datetime] = None

class Lesson(LessonBase):
    id: int
    created_at: Optional[datetime] = None
    attendance_saved: bool = False
    attendance_edit_used: bool = False
    class Config: from_attributes = True

class LessonAttendanceEntry(BaseModel):
    student_id: int
    penalty_hours: int
    score: Optional[float] = None
    grade: Optional[float] = None

class LessonAttendanceSaveRequest(BaseModel):
    records: List[LessonAttendanceEntry]

class AssignmentBase(BaseModel):
    title: str
    description: str
    course_id: int
    teacher_id: int
    student_id: Optional[int] = None  # null = assignment for entire course
    submitted: Optional[bool] = False
    submitted_at: Optional[datetime] = None

class AssignmentCreate(AssignmentBase): 
    pass

class Assignment(AssignmentBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True


class AssignmentStatusUpdateRequest(BaseModel):
    student_id: int
    status: str  # accepted | in_progress | completed


class AssignmentProgressBase(BaseModel):
    assignment_id: int
    teacher_id: int
    student_id: int
    course_id: int
    status: str
    seen_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    in_progress_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AssignmentProgress(AssignmentProgressBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class AttendanceBase(BaseModel):
    student_id: int
    course_id: int
    lesson_id: Optional[int] = None
    date: str
    status: str
    penalty_hours: Optional[int] = None
    late_minutes: Optional[int] = None
    grade: Optional[float] = None

class AttendanceCreate(AttendanceBase): pass
class Attendance(AttendanceBase):
    id: int
    class Config: from_attributes = True

class PerformanceBase(BaseModel):
    student_id: int
    course_id: int
    date: str
    score: float
    type: str
    label: str

class PerformanceCreate(PerformanceBase): pass
class Performance(PerformanceBase):
    id: int
    class Config: from_attributes = True

class PaymentBase(BaseModel):
    student_id: int
    course_id: int
    amount: float
    currency: Optional[str] = "USD"
    status: str = "pending"
    payment_method: Optional[str] = None  # card, uzum, click, payme
    payment_details: Optional[dict] = None
    due_date: Optional[str] = None
    paid_date: Optional[str] = None
    month: str
    card_last4: Optional[str] = None

class PaymentCreate(PaymentBase): pass
class PaymentUpdate(BaseModel):
    status: Optional[str] = None
    payment_method: Optional[str] = None
    payment_details: Optional[dict] = None
    paid_date: Optional[str] = None
    card_last4: Optional[str] = None

class Payment(PaymentBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    class Config: from_attributes = True

class StripeIntentRequest(BaseModel):
    student_id: int
    course_id: int
    amount: float
    payment_id: Optional[int] = None
    month: Optional[str] = None

class StripeConfirmRequest(BaseModel):
    payment_intent_id: str
    student_id: int
    course_id: int
    amount: Optional[float] = None
    payment_id: Optional[int] = None
    month: Optional[str] = None

class ClickInvoiceRequest(BaseModel):
    student_id: int
    course_id: int
    amount: float
    phone: str
    payment_id: Optional[int] = None
    month: Optional[str] = None

class ClickVerifyRequest(BaseModel):
    transaction_id: str
    student_id: int
    course_id: int
    amount: Optional[float] = None
    payment_id: Optional[int] = None
    month: Optional[str] = None

class PaymeReceiptRequest(BaseModel):
    student_id: int
    course_id: int
    amount: float
    phone: str
    payment_id: Optional[int] = None
    month: Optional[str] = None

class PaymeStatusRequest(BaseModel):
    receipt_id: str
    student_id: int
    course_id: int
    amount: Optional[float] = None
    payment_id: Optional[int] = None
    month: Optional[str] = None

class NotificationBase(BaseModel):
    user_id: int
    title: str
    message: str
    type: str  # assignment/payment/task status notification types
    assignment_id: Optional[int] = None
    read: Optional[bool] = False

class NotificationCreate(NotificationBase): 
    pass

class Notification(NotificationBase):
    id: int
    created_at: Optional[datetime] = None
    class Config: from_attributes = True

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterUserRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str
    name: str
    email: str
    avatar: Optional[str] = None
