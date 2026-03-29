from flask import Flask, jsonify, request, render_template, session, redirect, url_for
import sqlite3, json, os, random, hashlib
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'mrce_timetable_secret_2024'
DB = 'database.db'

IMP_PW         = {'high': 8, 'medium': 6, 'low': 4}
LAB_ROOMS      = ['Lab 01', 'Lab 02', 'Lab 03']
VALID_LAB_STARTS = [1, 4, 5]
DAYS           = 6
PERIODS        = [1, 2, 3, 4, 5, 6]

# ═══════════════════════════════════════════════════════════════════
#  DATABASE SETUP
# ═══════════════════════════════════════════════════════════════════
def get_conn():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS departments (
            key TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS dept_config (
            dept_key TEXT PRIMARY KEY,
            config_json TEXT NOT NULL,
            FOREIGN KEY(dept_key) REFERENCES departments(key)
        );
        CREATE TABLE IF NOT EXISTS faculty (
            id TEXT NOT NULL,
            dept_key TEXT NOT NULL,
            name TEXT NOT NULL,
            assignments_json TEXT DEFAULT '[]',
            PRIMARY KEY(id, dept_key),
            FOREIGN KEY(dept_key) REFERENCES departments(key)
        );
        CREATE TABLE IF NOT EXISTS timetables (
            dept_key TEXT PRIMARY KEY,
            schedule_json TEXT,
            generated_at TEXT,
            FOREIGN KEY(dept_key) REFERENCES departments(key)
        );
    ''')
    conn.commit()

    # Seed departments if empty
    c.execute("SELECT COUNT(*) FROM departments")
    if c.fetchone()[0] == 0:
        seed_departments(conn)
    conn.close()

def seed_departments(conn):
    c = conn.cursor()
    depts = [
        ('cse', 'Computer Science & Engineering',        'hodcse', 'cse@123'),
        ('csd', 'Computer Science & Data Science',       'hodcsd', 'csd@123'),
        ('csm', 'Computer Science & Mathematics',        'hodcsm', 'csm@123'),
        ('hs',  'Humanities & Sciences',                 'hodh&s', 'hs@123'),
        ('ece', 'Electronics & Communication Engineering','hodece', 'ece@123'),
    ]
    for key, name, user, pwd in depts:
        c.execute("INSERT INTO departments VALUES(?,?,?,?)", (key, name, user, pwd))
        c.execute("INSERT INTO dept_config VALUES(?,?)", (key, json.dumps(default_config(key))))
        c.execute("INSERT OR IGNORE INTO timetables VALUES(?,?,?)", (key, None, None))
    conn.commit()
    print("✓ 5 departments seeded")

def default_config(key):
    configs = {
        'cse': {
            'years': [
                {'id': 2, 'label': '2nd Year', 'sections': ['A','B','C','D']},
                {'id': 3, 'label': '3rd Year', 'sections': ['A','B','C','D']},
                {'id': 4, 'label': '4th Year', 'sections': ['A','B','C','D']}
            ],
            'subjects': {
                '2': {
                    'theory': [
                        {'name':'COSM','importance':'medium','periodsPerWeek':6},
                        {'name':'DS','importance':'medium','periodsPerWeek':6},
                        {'name':'DE','importance':'medium','periodsPerWeek':6},
                        {'name':'COA','importance':'medium','periodsPerWeek':6},
                        {'name':'OOPS','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'DS Lab','importance':'medium','periodsPerWeek':2},
                        {'name':'OOPS Lab','importance':'medium','periodsPerWeek':2},
                        {'name':'Power BI Lab','importance':'low','periodsPerWeek':2}
                    ]
                },
                '3': {
                    'theory': [
                        {'name':'ADA','importance':'high','periodsPerWeek':8},
                        {'name':'CN','importance':'medium','periodsPerWeek':6},
                        {'name':'IDS','importance':'medium','periodsPerWeek':6},
                        {'name':'DWBI','importance':'medium','periodsPerWeek':6},
                        {'name':'SPM','importance':'low','periodsPerWeek':4}
                    ],
                    'labs': [
                        {'name':'IDS Lab','importance':'medium','periodsPerWeek':2},
                        {'name':'CN Lab','importance':'medium','periodsPerWeek':2},
                        {'name':'AECS Lab','importance':'low','periodsPerWeek':2}
                    ]
                },
                '4': {
                    'theory': [
                        {'name':'PA','importance':'high','periodsPerWeek':8},
                        {'name':'WSMA','importance':'high','periodsPerWeek':8},
                        {'name':'PE 4','importance':'medium','periodsPerWeek':6},
                        {'name':'PE 5','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'PA Lab','importance':'high','periodsPerWeek':2},
                        {'name':'WSMA Lab','importance':'medium','periodsPerWeek':2}
                    ]
                }
            }
        },
        'csd': {
            'years': [
                {'id': 2, 'label': '2nd Year', 'sections': ['A','B','C']},
                {'id': 3, 'label': '3rd Year', 'sections': ['A','B','C','D']},
                {'id': 4, 'label': '4th Year', 'sections': ['A','B','C','D']}
            ],
            'subjects': {
                '2': {
                    'theory': [
                        {'name':'Python Programming','importance':'high','periodsPerWeek':8},
                        {'name':'Statistics','importance':'high','periodsPerWeek':8},
                        {'name':'DS','importance':'medium','periodsPerWeek':6},
                        {'name':'OOPS','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'Python Lab','importance':'high','periodsPerWeek':2},
                        {'name':'Stats Lab','importance':'medium','periodsPerWeek':2}
                    ]
                },
                '3': {
                    'theory': [
                        {'name':'Machine Learning','importance':'high','periodsPerWeek':8},
                        {'name':'Data Mining','importance':'high','periodsPerWeek':8},
                        {'name':'Big Data','importance':'medium','periodsPerWeek':6},
                        {'name':'Visualization','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'ML Lab','importance':'high','periodsPerWeek':2},
                        {'name':'Hadoop Lab','importance':'medium','periodsPerWeek':2}
                    ]
                },
                '4': {
                    'theory': [
                        {'name':'Deep Learning','importance':'high','periodsPerWeek':8},
                        {'name':'NLP','importance':'high','periodsPerWeek':8},
                        {'name':'Data Engineering','importance':'medium','periodsPerWeek':6},
                        {'name':'Capstone Project','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'DL Lab','importance':'high','periodsPerWeek':2},
                        {'name':'NLP Lab','importance':'medium','periodsPerWeek':2}
                    ]
                }
            }
        },
        'csm': {
            'years': [
                {'id': 2, 'label': '2nd Year', 'sections': ['A','B','C']},
                {'id': 3, 'label': '3rd Year', 'sections': ['A','B','C']},
                {'id': 4, 'label': '4th Year', 'sections': ['A','B','C']}
            ],
            'subjects': {
                '2': {
                    'theory': [
                        {'name':'Linear Algebra','importance':'high','periodsPerWeek':8},
                        {'name':'Calculus','importance':'high','periodsPerWeek':8},
                        {'name':'DS','importance':'medium','periodsPerWeek':6},
                        {'name':'Discrete Math','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'MATLAB Lab','importance':'high','periodsPerWeek':2},
                        {'name':'Python Lab','importance':'medium','periodsPerWeek':2}
                    ]
                },
                '3': {
                    'theory': [
                        {'name':'Numerical Methods','importance':'high','periodsPerWeek':8},
                        {'name':'Graph Theory','importance':'high','periodsPerWeek':8},
                        {'name':'Statistics','importance':'medium','periodsPerWeek':6},
                        {'name':'Operations Research','importance':'low','periodsPerWeek':4}
                    ],
                    'labs': [
                        {'name':'R Lab','importance':'high','periodsPerWeek':2},
                        {'name':'Scilab Lab','importance':'medium','periodsPerWeek':2}
                    ]
                },
                '4': {
                    'theory': [
                        {'name':'Machine Learning','importance':'high','periodsPerWeek':8},
                        {'name':'Cryptography','importance':'high','periodsPerWeek':8},
                        {'name':'Optimization','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'ML Lab','importance':'high','periodsPerWeek':2},
                        {'name':'Crypto Lab','importance':'medium','periodsPerWeek':2}
                    ]
                }
            }
        },
        'hs': {
            'years': [
                {'id': 1, 'label': '1st Year', 'sections': ['A','B','C','D']},
                {'id': 2, 'label': '2nd Year', 'sections': ['A','B','C','D']}
            ],
            'subjects': {
                '1': {
                    'theory': [
                        {'name':'Engineering Physics','importance':'high','periodsPerWeek':8},
                        {'name':'Engineering Chemistry','importance':'high','periodsPerWeek':8},
                        {'name':'Engineering Maths','importance':'high','periodsPerWeek':8},
                        {'name':'English','importance':'medium','periodsPerWeek':6},
                        {'name':'Environmental Science','importance':'low','periodsPerWeek':4}
                    ],
                    'labs': [
                        {'name':'Physics Lab','importance':'high','periodsPerWeek':2},
                        {'name':'Chemistry Lab','importance':'high','periodsPerWeek':2},
                        {'name':'Language Lab','importance':'medium','periodsPerWeek':2}
                    ]
                },
                '2': {
                    'theory': [
                        {'name':'Applied Maths','importance':'high','periodsPerWeek':8},
                        {'name':'Economics','importance':'medium','periodsPerWeek':6},
                        {'name':'Technical Writing','importance':'low','periodsPerWeek':4}
                    ],
                    'labs': [
                        {'name':'Communication Lab','importance':'medium','periodsPerWeek':2}
                    ]
                }
            }
        },
        'ece': {
            'years': [
                {'id': 2, 'label': '2nd Year', 'sections': ['A','B','C','D']},
                {'id': 3, 'label': '3rd Year', 'sections': ['A','B','C','D']},
                {'id': 4, 'label': '4th Year', 'sections': ['A','B','C','D']}
            ],
            'subjects': {
                '2': {
                    'theory': [
                        {'name':'Circuit Theory','importance':'high','periodsPerWeek':8},
                        {'name':'Signals & Systems','importance':'high','periodsPerWeek':8},
                        {'name':'Digital Electronics','importance':'medium','periodsPerWeek':6},
                        {'name':'Network Theory','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'Circuit Lab','importance':'high','periodsPerWeek':2},
                        {'name':'Digital Lab','importance':'medium','periodsPerWeek':2}
                    ]
                },
                '3': {
                    'theory': [
                        {'name':'VLSI Design','importance':'high','periodsPerWeek':8},
                        {'name':'Microprocessors','importance':'high','periodsPerWeek':8},
                        {'name':'Communication Systems','importance':'medium','periodsPerWeek':6},
                        {'name':'Control Systems','importance':'medium','periodsPerWeek':6}
                    ],
                    'labs': [
                        {'name':'VLSI Lab','importance':'high','periodsPerWeek':2},
                        {'name':'µP Lab','importance':'medium','periodsPerWeek':2},
                        {'name':'Comm Lab','importance':'medium','periodsPerWeek':2}
                    ]
                },
                '4': {
                    'theory': [
                        {'name':'Embedded Systems','importance':'high','periodsPerWeek':8},
                        {'name':'DSP','importance':'high','periodsPerWeek':8},
                        {'name':'Antenna Design','importance':'medium','periodsPerWeek':6},
                        {'name':'PE Elective','importance':'low','periodsPerWeek':4}
                    ],
                    'labs': [
                        {'name':'Embedded Lab','importance':'high','periodsPerWeek':2},
                        {'name':'DSP Lab','importance':'medium','periodsPerWeek':2}
                    ]
                }
            }
        }
    }
    return configs.get(key, {'years': [], 'subjects': {}})

# ═══════════════════════════════════════════════════════════════════
#  TIMETABLE GENERATOR
# ═══════════════════════════════════════════════════════════════════
def shuffle(lst):
    l = list(lst)
    random.shuffle(l)
    return l

def build_sf_map(faculty_list):
    sf = {}
    for f in faculty_list:
        for a in json.loads(f['assignments_json'] if isinstance(f, sqlite3.Row) else f.get('assignments_json','[]')):
            for sec in a.get('sections', []):
                sf[f"{a['year']}-{sec}-{a['subject']}"] = f['id'] if isinstance(f, sqlite3.Row) else f.get('id')
    return sf

def generate_timetable(dept_key):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT config_json FROM dept_config WHERE dept_key=?", (dept_key,))
    row = c.fetchone()
    cfg = json.loads(row['config_json'])
    c.execute("SELECT * FROM faculty WHERE dept_key=?", (dept_key,))
    faculty_list = [dict(r) for r in c.fetchall()]
    conn.close()

    years    = [y['id'] for y in cfg['years']]
    sf       = build_sf_map(faculty_list)
    imp_order = {'high': 0, 'medium': 1, 'low': 2}

    # Build schedule: sch[year][section][day][period]
    sch = {}
    for y in years:
        yr_obj = next(yr for yr in cfg['years'] if yr['id'] == y)
        sections = yr_obj['sections']
        sch[y] = {}
        for s in sections:
            sch[y][s] = {}
            for d in range(DAYS):
                sch[y][s][d] = {}
                for p in PERIODS:
                    sch[y][s][d][p] = None

    # Faculty busy tracker
    busy = {}
    for f in faculty_list:
        busy[f['id']] = {d: {p: False for p in PERIODS} for d in range(DAYS)}

    # Lab room tracker
    lab_rooms = {d: {p: [] for p in PERIODS} for d in range(DAYS)}

    # Same lab+year restriction
    lab_year_sub = {}
    for y in years:
        lab_year_sub[y] = {}
        subs = cfg['subjects'].get(str(y), {})
        for lab in subs.get('labs', []):
            lab_year_sub[y][lab['name']] = {d: {p: False for p in PERIODS} for d in range(DAYS)}

    def is_free(fid, d, p):
        if not fid: return True
        return not busy.get(fid, {}).get(d, {}).get(p, False)

    def set_busy(fid, d, p):
        if fid and fid in busy:
            busy[fid][d][p] = True

    def daily_load(fid, d):
        if not fid or fid not in busy: return 0
        return sum(1 for p in PERIODS if busy[fid][d].get(p, False))

    # All year-section combos shuffled
    all_sec = shuffle([(y, s) for y in years for s in sch[y]])

    # ── PHASE 1: Labs ──────────────────────────────────────────────
    for (y, s) in all_sec:
        subs = cfg['subjects'].get(str(y), {})
        labs = sorted(subs.get('labs', []), key=lambda x: imp_order.get(x['importance'], 1))
        for lab in labs:
            fid = sf.get(f"{y}-{s}-{lab['name']}")
            placed = False
            for d in shuffle(range(DAYS)):
                if placed: break
                if any(sch[y][s][d].get(p, {}) and sch[y][s][d][p] and sch[y][s][d][p].get('is_lab') for p in PERIODS):
                    continue
                for sp in shuffle(VALID_LAB_STARTS):
                    if placed: break
                    ep = sp + 1
                    if sch[y][s][d].get(sp) or sch[y][s][d].get(ep): continue
                    if not is_free(fid, d, sp) or not is_free(fid, d, ep): continue
                    if fid and daily_load(fid, d) >= 4: continue
                    if len(lab_rooms[d][sp]) >= 3 or len(lab_rooms[d][ep]) >= 3: continue
                    if lab_year_sub.get(y, {}).get(lab['name'], {}).get(d, {}).get(sp) or \
                       lab_year_sub.get(y, {}).get(lab['name'], {}).get(d, {}).get(ep): continue
                    room = next((r for r in LAB_ROOMS if r not in lab_rooms[d][sp] and r not in lab_rooms[d][ep]), None)
                    if not room: continue
                    slot = {'subject': lab['name'], 'faculty_id': fid, 'room': room,
                            'is_lab': True, 'is_cont': False, 'is_special': False, 'importance': lab['importance']}
                    sch[y][s][d][sp] = slot
                    sch[y][s][d][ep] = {**slot, 'is_cont': True}
                    set_busy(fid, d, sp); set_busy(fid, d, ep)
                    lab_rooms[d][sp].append(room); lab_rooms[d][ep].append(room)
                    if y in lab_year_sub and lab['name'] in lab_year_sub[y]:
                        lab_year_sub[y][lab['name']][d][sp] = True
                        lab_year_sub[y][lab['name']][d][ep] = True
                    placed = True

    # ── PHASE 2: Sports (P6 once/week) ────────────────────────────
    for (y, s) in all_sec:
        for d in range(DAYS):
            if not sch[y][s][d][6]:
                sch[y][s][d][6] = {'subject': 'Sports', 'faculty_id': None, 'room': None,
                                   'is_lab': False, 'is_cont': False, 'is_special': True, 'importance': None}
                break

    # ── PHASE 3: Library (P3 or P6 once/week) ─────────────────────
    for (y, s) in all_sec:
        placed = False
        for d in shuffle(range(DAYS)):
            if placed: break
            for p in [3, 6]:
                if not sch[y][s][d][p]:
                    sch[y][s][d][p] = {'subject': 'Library', 'faculty_id': None, 'room': None,
                                       'is_lab': False, 'is_cont': False, 'is_special': True, 'importance': None}
                    placed = True; break

    # ── PHASE 4: Theory (importance-weighted) ─────────────────────
    for (y, s) in all_sec:
        subs = cfg['subjects'].get(str(y), {})
        theory = subs.get('theory', [])
        needed = {sub['name']: sub.get('periodsPerWeek', IMP_PW.get(sub['importance'], 6)) for sub in theory}
        for d in range(DAYS):
            for p in PERIODS:
                if sch[y][s][d][p]: continue
                candidates = [
                    sub for sub in theory
                    if needed.get(sub['name'], 0) > 0
                    and is_free(sf.get(f"{y}-{s}-{sub['name']}"), d, p)
                    and (not sf.get(f"{y}-{s}-{sub['name']}") or daily_load(sf.get(f"{y}-{s}-{sub['name']}"), d) < 4)
                ]
                candidates.sort(key=lambda x: (imp_order.get(x['importance'], 1), -needed.get(x['name'], 0)))
                if not candidates: continue
                sub = candidates[0]
                fid = sf.get(f"{y}-{s}-{sub['name']}")
                sch[y][s][d][p] = {'subject': sub['name'], 'faculty_id': fid, 'room': None,
                                   'is_lab': False, 'is_cont': False, 'is_special': False, 'importance': sub['importance']}
                set_busy(fid, d, p)
                needed[sub['name']] -= 1

    return sch

# ═══════════════════════════════════════════════════════════════════
#  ROUTES — PAGES
# ═══════════════════════════════════════════════════════════════════
@app.route('/')
def index():
    if 'user' in session:
        if session['user']['type'] == 'hod':
            return redirect(url_for('dashboard'))
        return redirect(url_for('faculty_portal'))
    return redirect(url_for('login'))

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    if 'user' not in session or session['user']['type'] != 'hod':
        return redirect(url_for('login'))
    return render_template('dashboard.html', user=session['user'])

@app.route('/timetable')
def timetable():
    if 'user' not in session or session['user']['type'] != 'hod':
        return redirect(url_for('login'))
    return render_template('timetable.html', user=session['user'])

@app.route('/faculty-manage')
def faculty_manage():
    if 'user' not in session or session['user']['type'] != 'hod':
        return redirect(url_for('login'))
    return render_template('faculty.html', user=session['user'])

@app.route('/config')
def config():
    if 'user' not in session or session['user']['type'] != 'hod':
        return redirect(url_for('login'))
    return render_template('config.html', user=session['user'])

@app.route('/portal')
def faculty_portal():
    if 'user' not in session or session['user']['type'] != 'faculty':
        return redirect(url_for('login'))
    return render_template('portal.html', user=session['user'])

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ═══════════════════════════════════════════════════════════════════
#  API — AUTH
# ═══════════════════════════════════════════════════════════════════
@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.json
    conn = get_conn(); c = conn.cursor()
    if data.get('type') == 'hod':
        c.execute("SELECT * FROM departments WHERE username=?", (data.get('username',''),))
        dept = c.fetchone()
        conn.close()
        if not dept: return jsonify({'ok': False, 'error': 'Username not found'}), 401
        if dept['password'] != data.get('password',''): return jsonify({'ok': False, 'error': 'Wrong password'}), 401
        session['user'] = {'type': 'hod', 'deptKey': dept['key'], 'deptName': dept['name']}
        return jsonify({'ok': True, 'type': 'hod', 'deptKey': dept['key'], 'deptName': dept['name']})
    if data.get('type') == 'faculty':
        dk = data.get('deptKey','')
        c.execute("SELECT * FROM faculty WHERE id=? AND dept_key=?", (data.get('facultyId',''), dk))
        f = c.fetchone(); conn.close()
        if not f: return jsonify({'ok': False, 'error': 'Faculty not found'}), 401
        session['user'] = {'type': 'faculty', 'deptKey': dk, 'id': f['id'], 'name': f['name']}
        return jsonify({'ok': True, 'type': 'faculty', 'deptKey': dk, 'id': f['id'], 'name': f['name']})
    return jsonify({'ok': False, 'error': 'Invalid'}), 400

@app.route('/api/departments')
def api_departments():
    conn = get_conn(); c = conn.cursor()
    c.execute("SELECT key, name FROM departments")
    rows = [dict(r) for r in c.fetchall()]; conn.close()
    return jsonify(rows)

# ═══════════════════════════════════════════════════════════════════
#  API — CONFIG
# ═══════════════════════════════════════════════════════════════════
@app.route('/api/dept/<dk>/config', methods=['GET'])
def api_get_config(dk):
    conn = get_conn(); c = conn.cursor()
    c.execute("SELECT config_json FROM dept_config WHERE dept_key=?", (dk,))
    row = c.fetchone(); conn.close()
    if not row: return jsonify({'error': 'Not found'}), 404
    return jsonify(json.loads(row['config_json']))

@app.route('/api/dept/<dk>/config', methods=['PUT'])
def api_put_config(dk):
    conn = get_conn(); c = conn.cursor()
    c.execute("UPDATE dept_config SET config_json=? WHERE dept_key=?", (json.dumps(request.json), dk))
    c.execute("UPDATE timetables SET schedule_json=NULL WHERE dept_key=?", (dk,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

# ═══════════════════════════════════════════════════════════════════
#  API — FACULTY
# ═══════════════════════════════════════════════════════════════════
@app.route('/api/dept/<dk>/faculty', methods=['GET'])
def api_get_faculty(dk):
    conn = get_conn(); c = conn.cursor()
    c.execute("SELECT * FROM faculty WHERE dept_key=? ORDER BY id", (dk,))
    rows = []
    for r in c.fetchall():
        d = dict(r); d['assignments'] = json.loads(d['assignments_json']); rows.append(d)
    conn.close(); return jsonify(rows)

@app.route('/api/dept/<dk>/faculty', methods=['POST'])
def api_add_faculty(dk):
    data = request.json
    if not data.get('name'): return jsonify({'error': 'Name required'}), 400
    conn = get_conn(); c = conn.cursor()
    c.execute("SELECT id FROM faculty WHERE dept_key=? ORDER BY id DESC LIMIT 1", (dk,))
    last = c.fetchone()
    num = int(last['id'].replace('F','')) + 1 if last else 1
    new_id = f"F{num:02d}"
    c.execute("INSERT INTO faculty VALUES(?,?,?,?)",
              (new_id, dk, data['name'].strip(), json.dumps(data.get('assignments',[]))))
    conn.commit(); conn.close()
    return jsonify({'ok': True, 'id': new_id})

@app.route('/api/dept/<dk>/faculty/<fid>', methods=['PUT'])
def api_update_faculty(dk, fid):
    data = request.json
    conn = get_conn(); c = conn.cursor()
    c.execute("UPDATE faculty SET name=?, assignments_json=? WHERE id=? AND dept_key=?",
              (data['name'].strip(), json.dumps(data.get('assignments',[])), fid, dk))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/dept/<dk>/faculty/<fid>', methods=['DELETE'])
def api_delete_faculty(dk, fid):
    conn = get_conn(); c = conn.cursor()
    c.execute("DELETE FROM faculty WHERE id=? AND dept_key=?", (fid, dk))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

# ═══════════════════════════════════════════════════════════════════
#  API — TIMETABLE
# ═══════════════════════════════════════════════════════════════════
@app.route('/api/dept/<dk>/timetable/generate', methods=['POST'])
def api_generate(dk):
    try:
        print(f"⚡ Generating timetable for {dk}...")
        sch = generate_timetable(dk)
        conn = get_conn(); c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO timetables VALUES(?,?,?)",
                  (dk, json.dumps(sch), datetime.now().isoformat()))
        conn.commit(); conn.close()
        total = lab = theory = 0
        cfg = api_get_config(dk).get_json()
        for y in [yr['id'] for yr in cfg['years']]:
            for yr in cfg['years']:
                if yr['id'] == y:
                    for s in yr['sections']:
                        for d in range(6):
                            for p in range(1,7):
                                sl = sch.get(y,{}).get(s,{}).get(d,{}).get(p)
                                if sl and not sl.get('is_cont'):
                                    total += 1
                                    if sl.get('is_lab'): lab += 1
                                    elif not sl.get('is_special'): theory += 1
        print(f"✓ Done: {total} slots ({lab} lab, {theory} theory)")
        return jsonify({'ok': True, 'stats': {'total': total, 'lab': lab, 'theory': theory}})
    except Exception as e:
        print(f"Generator error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dept/<dk>/timetable', methods=['GET'])
def api_get_timetable(dk):
    conn = get_conn(); c = conn.cursor()
    c.execute("SELECT * FROM timetables WHERE dept_key=?", (dk,))
    row = c.fetchone(); conn.close()
    if not row or not row['schedule_json']:
        return jsonify({'generated': False, 'schedule': None})
    return jsonify({'generated': True, 'schedule': json.loads(row['schedule_json']),
                    'generatedAt': row['generated_at']})

@app.route('/api/dept/<dk>/stats', methods=['GET'])
def api_stats(dk):
    conn = get_conn(); c = conn.cursor()
    c.execute("SELECT COUNT(*) as cnt FROM faculty WHERE dept_key=?", (dk,))
    fac_count = c.fetchone()['cnt']
    c.execute("SELECT schedule_json FROM timetables WHERE dept_key=?", (dk,))
    tt = c.fetchone(); conn.close()
    total = lab = 0
    generated = False
    if tt and tt['schedule_json']:
        generated = True
        sch = json.loads(tt['schedule_json'])
        cfg = api_get_config(dk).get_json()
        for yr in cfg['years']:
            for s in yr['sections']:
                for d in range(6):
                    for p in range(1,7):
                        sl = sch.get(yr['id'],{}).get(s,{}).get(d,{}).get(p)
                        if sl and not sl.get('is_cont'):
                            total += 1
                            if sl.get('is_lab'): lab += 1
    cfg = api_get_config(dk).get_json()
    total_sections = sum(len(yr['sections']) for yr in cfg['years'])
    return jsonify({'totalFaculty': fac_count, 'totalSlots': total, 'labSlots': lab,
                    'generated': generated, 'totalSections': total_sections})

# ═══════════════════════════════════════════════════════════════════
#  API — CALENDAR (ICS + WhatsApp)
# ═══════════════════════════════════════════════════════════════════
@app.route('/api/dept/<dk>/calendar/ics/<int:year>/<section>')
def api_ics(dk, year, section):
    conn = get_conn(); c = conn.cursor()
    c.execute("SELECT schedule_json FROM timetables WHERE dept_key=?", (dk,))
    tt = c.fetchone()
    c.execute("SELECT * FROM faculty WHERE dept_key=?", (dk,))
    fac_list = {f['id']: f['name'] for f in c.fetchall()}
    c.execute("SELECT name FROM departments WHERE key=?", (dk,))
    dept_name = c.fetchone()['name']
    conn.close()
    if not tt or not tt['schedule_json']:
        return jsonify({'error': 'No timetable'}), 400

    sch = json.loads(tt['schedule_json'])
    sec = section.upper()
    PT  = [('090000','095500'),('100000','105500'),('110000','115500'),
           ('130000','135500'),('140000','145500'),('150000','155500')]
    BD  = ['MO','TU','WE','TH','FR','SA']
    uid = 1
    lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MRCE Smart Timetable//EN',
             'CALSCALE:GREGORIAN','METHOD:PUBLISH',
             f'X-WR-CALNAME:{dept_name} Y{year} Sec {sec}']
    for d in range(6):
        for p in PERIODS:
            sl = sch.get(year, sch.get(str(year),{})).get(sec,{}).get(d,{}).get(p, sch.get(year,sch.get(str(year),{})).get(sec,{}).get(str(d),{}).get(str(p)))
            if not sl or sl.get('is_cont'): continue
            pt = PT[p-1]
            lines += ['BEGIN:VEVENT',
                      f'UID:mrce-{dk}-{year}-{sec}-{d}-{p}-{uid}@mrce.in',
                      f'DTSTART:20241104T{pt[0]}',f'DTEND:20241104T{pt[1]}',
                      f'RRULE:FREQ=WEEKLY;BYDAY={BD[d]}',f'SUMMARY:{sl["subject"]}']
            if sl.get('faculty_id'): lines.append(f'DESCRIPTION:Faculty: {fac_list.get(sl["faculty_id"], sl["faculty_id"])}')
            if sl.get('room'): lines.append(f'LOCATION:{sl["room"]}')
            lines.append('END:VEVENT'); uid += 1
    lines.append('END:VCALENDAR')
    from flask import Response
    return Response('\r\n'.join(lines), mimetype='text/calendar',
                    headers={'Content-Disposition': f'attachment; filename="{dk}_Y{year}_{sec}.ics"'})

@app.route('/calendar/<dk>/<int:year>/<section>')
def public_calendar(dk, year, section):
    return redirect(url_for('api_ics', dk=dk, year=year, section=section))

# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    init_db()
    print("""
╔══════════════════════════════════════════════════════════╗
║   MRCE SMART TIMETABLE MANAGER  — Python Flask           ║
║   http://localhost:5000                                  ║
╠══════════════════════════════════════════════════════════╣
║  hodcse / cse@123  →  CS & Engineering                   ║
║  hodcsd / csd@123  →  CS & Data Science                  ║
║  hodcsm / csm@123  →  CS & Mathematics                   ║
║  hodh&s / hs@123   →  Humanities & Sciences              ║
║  hodece / ece@123  →  Electronics & Communication        ║
╚══════════════════════════════════════════════════════════╝
    """)
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
