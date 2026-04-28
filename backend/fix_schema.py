import psycopg2
from psycopg2 import sql

# Database connection details
conn = psycopg2.connect(
    host="localhost",
    database="Bron",
    user="postgres",
    password="jonibek",
    port=5432
)

cursor = conn.cursor()

try:
    # Add missing columns to barber table
    alter_commands = [
        'ALTER TABLE barber ADD COLUMN IF NOT EXISTS photo_url VARCHAR NULL;',
        'ALTER TABLE barber ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 1;',
        'ALTER TABLE barber ADD COLUMN IF NOT EXISTS username VARCHAR NULL;',
        'ALTER TABLE barber ADD COLUMN IF NOT EXISTS password VARCHAR NULL;',
        'ALTER TABLE barber ADD COLUMN IF NOT EXISTS bio VARCHAR NULL;',
        'ALTER TABLE barber ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();',
        'ALTER TABLE barber ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();',
    ]
    
    for cmd in alter_commands:
        cursor.execute(cmd)
        print(f"✓ Executed: {cmd}")
    
    conn.commit()
    print("\n✓ All columns added successfully!")
    
except Exception as e:
    print(f"✗ Error: {e}")
    conn.rollback()
finally:
    cursor.close()
    conn.close()
