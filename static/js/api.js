/* ================================================================
   api.js — Shared API layer, utilities, constants
   ================================================================ */

// ── Constants ─────────────────────────────────────────────────────
const DAYS_SHORT   = ['MON','TUE','WED','THU','FRI','SAT'];
const PERIOD_TIMES = ['9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM'];
const PERIODS      = [1,2,3,4,5,6];
const IMP_PW       = {high:8, medium:6, low:4};
const IMP_ORDER    = ['high','medium','low'];
const IMP_RANK     = {high:0, medium:1, low:2};

// ── Subject colour palette ────────────────────────────────────────
const PALETTE = [
  '#1d4ed8','#0f766e','#b45309','#b91c1c','#6d28d9','#065f46','#4c1d95',
  '#78350f','#075985','#15803d','#991b1b','#5b21b6','#c2410c','#0e7490',
  '#166534','#9a3412','#1e40af','#064e3b','#713f12','#581c87','#1e3a8a',
  '#022c22','#9f1239','#7c2d12','#134e4a','#3b0764','#431407','#1e3a5f',
  '#0c4a6e','#365314','#450a0a','#1c1917'
];
const _colours = {}; let _ci = 0;
function subColour(name) {
  if (name === 'Sports')  return '#9f1239';
  if (name === 'Library') return '#7c2d12';
  if (!_colours[name]) _colours[name] = PALETTE[_ci++ % PALETTE.length];
  return _colours[name];
}

// ── Year label helper ─────────────────────────────────────────────
function yearLabel(id) {
  const m = {1:'1st',2:'2nd',3:'3rd',4:'4th'};
  return (m[id] || id+'th') + ' Year';
}

// ── Escape HTML ───────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Session storage helpers ───────────────────────────────────────
const Store = {
  get:    (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch(e) { return null; } },
  set:    (k, v) => sessionStorage.setItem(k, JSON.stringify(v)),
  clear:  () => sessionStorage.clear(),
  user:   () => Store.get('user'),
  deptKey:() => Store.get('user')?.deptKey || ''
};

// ── Fetch wrapper ─────────────────────────────────────────────────
async function apiFetch(method, url, body) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}
const apiGet  = (url)    => apiFetch('GET',    url);
const apiPost = (url, b) => apiFetch('POST',   url, b);
const apiPut  = (url, b) => apiFetch('PUT',    url, b);
const apiDel  = (url)    => apiFetch('DELETE', url);
const dkUrl   = (path)   => `/api/dept/${Store.deptKey()}${path}`;

// ── Toast ─────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.className = '', 3500);
}

// ── Loading overlay ───────────────────────────────────────────────
function showLoad(txt = 'LOADING...') {
  const ov = document.getElementById('load-overlay');
  const tx = document.getElementById('load-text');
  if (ov) ov.classList.add('show');
  if (tx) tx.textContent = txt;
}
function hideLoad() {
  const ov = document.getElementById('load-overlay');
  if (ov) ov.classList.remove('show');
}

// ── Auth guard ────────────────────────────────────────────────────
function requireHOD() {
  const user = Store.user();
  if (!user || user.type !== 'hod') { window.location.href = '/login'; return false; }
  return true;
}
function requireFaculty() {
  const user = Store.user();
  if (!user || user.type !== 'faculty') { window.location.href = '/login'; return false; }
  return true;
}

// ── Topbar builder ────────────────────────────────────────────────
function buildTopbar(activeTab) {
  const user = Store.user();
  if (!user) return;
  const abbr = (user.deptName || '').split(' ').map(w=>w[0]).join('');
  const tabs = [
    { href:'/dashboard',       icon:'⬛', label:'DASHBOARD'  },
    { href:'/timetable',       icon:'📋', label:'TIMETABLE'  },
    { href:'/faculty-manage',  icon:'👤', label:'FACULTY'    },
    { href:'/config',          icon:'⚙', label:'CONFIG'     },
  ];
  document.getElementById('topbar-tabs').innerHTML = tabs.map(t =>
    `<a href="${t.href}" class="nav-tab ${activeTab===t.label?'active':''}">${t.icon} ${t.label}</a>`
  ).join('');
  document.getElementById('topbar-badge').textContent = abbr;
  document.getElementById('topbar-dept').textContent  = user.deptName || '';
}

// ── Timetable slot renderer ───────────────────────────────────────
function renderSlot(slot) {
  if (!slot) return `<td class="tt-slot empty"></td>`;
  const bg = subColour(slot.subject);
  if (slot.is_cont) return `<td class="tt-slot" style="background:${bg};opacity:.55"><div class="tt-cont">↕ cont.</div></td>`;
  return `<td class="tt-slot" style="background:${bg}">
    <div class="tt-sub">${esc(slot.subject||'')}</div>
    ${slot.faculty_id ? `<div class="tt-fac">${esc(slot._facName||slot.faculty_id)}</div>` : ''}
    ${slot.room ? `<span class="tt-room">${esc(slot.room)}</span>` : ''}
    ${slot.is_special ? `<div style="font-size:9px;color:rgba(255,255,255,.5);margin-top:1px">★</div>` : ''}
    ${slot.importance ? `<div style="font-size:8px;margin-top:2px;opacity:.7"><span class="imp-dot-${slot.importance}"></span>${slot.importance.toUpperCase()}</div>` : ''}
  </td>`;
}

// ── Section timetable grid ────────────────────────────────────────
function renderSecGrid(schedule, year, section, facMap) {
  if (!schedule) return `<div class="empty-state">⚡ Generate timetable from Dashboard first</div>`;
  const sch = (schedule[year] || schedule[String(year)] || {})[section] || {};
  if (!Object.keys(sch).length) return `<div class="empty-state">No data for Y${year} / Sec ${section}</div>`;

  // Attach faculty names
  for (let d=0;d<6;d++) for (const p of PERIODS) {
    const sl = sch[d]?.[p] || sch[String(d)]?.[String(p)];
    if (sl && sl.faculty_id && facMap) sl._facName = facMap[sl.faculty_id]?.split(' ').pop() || sl.faculty_id;
  }

  let html = `<div class="tt-wrap"><table class="tt-table"><thead><tr>
    <th class="ph">PERIOD</th>
    ${DAYS_SHORT.map(d=>`<th>${d}</th>`).join('')}
  </tr></thead><tbody>`;

  for (let pi=0; pi<PERIODS.length; pi++) {
    const p = PERIODS[pi];
    if (p===3) html += `<tr class="tt-break"><td colspan="7">── BREAK ──────────────────────────────</td></tr>`;
    if (p===4) html += `<tr class="tt-lunch"><td colspan="7">── LUNCH ──────────────────────────────</td></tr>`;
    html += `<tr>
      <td class="tt-pc"><div class="tt-pn">P${p}</div><div class="tt-pt">${PERIOD_TIMES[pi]}</div></td>
      ${Array.from({length:6}, (_,d) => renderSlot((sch[d]||sch[String(d)]||{})[p]||(sch[d]||sch[String(d)]||{})[String(p)])).join('')}
    </tr>`;
  }
  return html + `</tbody></table></div>`;
}

// ── Faculty personal timetable ────────────────────────────────────
function renderFacGrid(schedule, config, facId) {
  if (!schedule || !config) return `<div class="empty-state">No timetable generated yet</div>`;
  const grid = {};
  for (let d=0;d<6;d++) { grid[d]={}; for (const p of PERIODS) grid[d][p]=null; }

  for (const yr of config.years) {
    for (const sec of yr.sections) {
      const y = yr.id;
      for (let d=0;d<6;d++) for (const p of PERIODS) {
        const sl = (schedule[y]||schedule[String(y)]||{})[sec]?.[d]?.[p]
                || (schedule[y]||schedule[String(y)]||{})[sec]?.[String(d)]?.[String(p)];
        if (sl && sl.faculty_id === facId && !sl.is_cont) {
          grid[d][p] = {...sl, _year: y, _sec: sec};
        }
      }
    }
  }

  let html = `<div class="tt-wrap"><table class="tt-table"><thead><tr>
    <th class="ph">PERIOD</th>
    ${DAYS_SHORT.map(d=>`<th>${d}</th>`).join('')}
  </tr></thead><tbody>`;

  for (let pi=0; pi<PERIODS.length; pi++) {
    const p = PERIODS[pi];
    if (p===3) html += `<tr class="tt-break"><td colspan="7">── BREAK ──────────────────────────────</td></tr>`;
    if (p===4) html += `<tr class="tt-lunch"><td colspan="7">── LUNCH ──────────────────────────────</td></tr>`;
    html += `<tr><td class="tt-pc"><div class="tt-pn">P${p}</div><div class="tt-pt">${PERIOD_TIMES[pi]}</div></td>`;
    for (let d=0;d<6;d++) {
      const sl = grid[d][p];
      if (!sl) { html += `<td class="tt-slot empty"></td>`; continue; }
      const bg = subColour(sl.subject);
      html += `<td class="tt-slot" style="background:${bg}">
        <div class="tt-sub">${esc(sl.subject)}</div>
        <div class="tt-fac">Y${sl._year} / Sec ${sl._sec}</div>
        ${sl.room ? `<span class="tt-room">${esc(sl.room)}</span>` : ''}
      </td>`;
    }
    html += `</tr>`;
  }
  return html + `</tbody></table></div>`;
}

// ── WhatsApp message builder ──────────────────────────────────────
function buildWhatsAppMsg(deptName, yearLabel, section, link) {
  return `📅 *${deptName}*
*${yearLabel} — Section ${section} Timetable*

Your semester timetable is ready! 🎓

Click the link below to add it directly to your Google Calendar:

🔗 ${link}

*Steps:*
1️⃣ Tap the link
2️⃣ Tap "Add to Calendar"
3️⃣ Done ✅ — Full semester in your calendar!

_Auto-updates if timetable changes._
— MRCE Academic Department`;
}
