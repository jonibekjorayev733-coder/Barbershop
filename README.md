# Barbershop Platform

Pre-login landing page now includes:

- Map-based barbershop discovery
- Auto geolocation detection
- `Yaqin atrofdan izlash` / `Uzoqdan izlash` filters
- Clickable map markers with barbershop details and barber list
- Realtime refresh via websocket channel `public-map`

Admin improvements:

- Barbershop entity support in backend
- Assign barber to barbershop section in admin `BarbersPage`

## Run frontend

```powershell
cd C:\Users\NotebookService\Desktop\barber
npm install
npm run dev
```

## Build frontend

```powershell
cd C:\Users\NotebookService\Desktop\barber
npm run build
```

## Run backend (FastAPI)

```powershell
cd C:\Users\NotebookService\Desktop\barber\backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Key new API endpoints

- `GET /public/barbershops?lat=&lng=&scope=near|far`
- `GET /public/barbershops/{shop_id}`
- `POST /barbershops`
- `PUT /barbershops/{shop_id}`
- `POST /barbershops/{shop_id}/assign-barber`
- `WS /ws/events/public-map`
