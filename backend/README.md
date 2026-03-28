# Electoral Security System (Backend)

Flask backend for voter registration + face verification.

## Requirements
- Python 3.10+ recommended
- A working webcam on the client machine (frontend captures frames)
- Model files placed locally (not committed to git):
  - `backend/weights/best.pt` (YOLOv5 face detector)
  - `backend/weights/epoch_15.pth` (FaceCNN recognizer)

## One-time Setup
```bash
pip install -r requirements.txt
```

### YOLOv5 repo (important)
This project loads YOLOv5 using the repo-style layout (expects `models/common.py` etc).

Clone YOLOv5 into:
```bash
git clone https://github.com/ultralytics/yolov5.git backend/yolov5
```

## Run
```bash
python app.py
```
Backend starts at `http://127.0.0.1:5000`.

## Frontend
In a separate terminal:
```bash
cd ../electroal-system
npm install
npm start
```
Frontend starts at `http://localhost:3000`.

## Registration (Supervisor Update)
- Registration is unique by `citizenship_no` (register once)
- System generates `voter_id`
- Frontend captures **10 webcam frames** and backend stores **multiple embeddings** per voter in SQLite

## Default Login
- Username: `admin`
- Password: `admin123`

## Dev Reset
Stop the backend first (or the DB file will be locked), then:
```powershell
cd backend
powershell -ExecutionPolicy Bypass -File .\reset_dev_data.ps1
```

