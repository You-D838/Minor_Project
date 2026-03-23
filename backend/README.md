# Electoral Security System — Backend Setup Guide

## Folder Structure
```
backend/
├── app.py
├── middleware.py
├── requirements.txt
├── README.md
├── weights/
│   └── best.pt          ← PUT YOUR YOLO WEIGHTS HERE
├── database/
│   ├── __init__.py      ← empty file
│   └── db.py
├── routes/
│   ├── __init__.py      ← empty file
│   ├── auth.py
│   ├── voters.py
│   ├── verify.py
│   ├── intruders.py
│   └── stats.py
├── models/
│   ├── __init__.py      ← empty file
│   ├── detector.py
│   └── recognizer.py
├── voter_photos/        ← auto-created
└── static/
    └── intruder_captures/  ← auto-created
```

## Step 1 — Install dependencies
```bash
pip install -r requirements.txt
```

## Step 2 — Create empty __init__.py files
```bash
# Windows
type nul > database/__init__.py
type nul > routes/__init__.py
type nul > models/__init__.py

# Mac/Linux
touch database/__init__.py routes/__init__.py models/__init__.py
```

## Step 3 — Place your YOLO weights
Copy your best.pt file to:
```
backend/weights/best.pt
```

## Step 4 — Run the backend
```bash
python app.py
```
Server starts at http://localhost:5000

## Step 5 — Run the frontend
In a separate terminal:
```bash
cd electoral-system
npm start
```
Frontend starts at http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login with username/password |
| POST | /api/voters/register | Register new voter with photo |
| GET | /api/voters | Get all voters |
| GET | /api/voters/recent | Get recent 10 activity |
| POST | /api/verify | Verify face from webcam |
| GET | /api/intruders | Get all intruder records |
| GET | /api/stats | Get dashboard statistics |

## Default Login
Username: admin
Password: admin123

## Notes
- Database (electoral.db) is auto-created on first run
- embeddings.pkl is auto-created as voters are registered
- Each new voter registration automatically generates their face embedding
- Intruder captures are saved to static/intruder_captures/
