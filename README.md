# MRCE Smart Timetable Manager v4.0
**Multi-Department Academic Scheduling System**
Python Flask + SQLite — No C++ required

---

## Quick Start

### Windows (double-click)
```
start.bat
```

### Manual
```bash
pip install flask
python app.py
```
Open → http://localhost:5000

---

## HOD Logins
| Username | Password | Department |
|----------|----------|------------|
| hodcse   | cse@123  | CS & Engineering |
| hodcsd   | csd@123  | CS & Data Science |
| hodcsm   | csm@123  | CS & Mathematics |
| hodh&s   | hs@123   | Humanities & Sciences |
| hodece   | ece@123  | Electronics & Communication |

---

## Project Structure
```
smart-timetable/
├── app.py              ← Flask backend + SQLite + Generator
├── database.db         ← Auto-created on first run
├── requirements.txt    ← flask only
├── start.bat           ← Windows launcher
│
├── templates/          ← HTML pages
│   ├── login.html
│   ├── dashboard.html
│   ├── timetable.html
│   ├── faculty.html
│   ├── config.html
│   └── portal.html
│
└── static/
    ├── css/
    │   └── style.css
    └── js/
        ├── api.js
        ├── dashboard.js
        ├── timetable.js
        ├── faculty.js
        ├── config.js
        └── portal.js
```

---

## Production (College Server)
```bash
pip install flask gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## College IT Setup
1. Assign static IP to server PC
2. Add DNS: timetable.mrce.in → server IP
3. Open port 5000 on firewall
4. All HODs access via http://timetable.mrce.in
