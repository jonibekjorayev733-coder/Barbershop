import os
from dotenv import load_dotenv

load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@qarz.uz")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@12345")
