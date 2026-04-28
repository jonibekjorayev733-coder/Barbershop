import psycopg2

conn = psycopg2.connect('postgresql://postgres:jonibek@localhost:5432/postgres')
conn.autocommit = True
cur = conn.cursor()

try:
    cur.execute('DROP DATABASE IF EXISTS "Bron"')
    print('Database Bron dropped')
except:
    pass

cur.execute('CREATE DATABASE "Bron"')
print('Database Bron created successfully')
conn.close()
