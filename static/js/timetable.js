/* timetable.js */
if (!requireHOD()) throw new Error('Not authenticated');
buildTopbar('TIMETABLE');

let _cfg = null, _schedule = null, _facMap = {}, _selYear = null, _selSec = null;
const user = Store.user();

async function init() {
  showLoad('LOADING TIMETABLE...');
  try {
    [_cfg, _schedule] = await Promise.all([
      apiGet(dkUrl('/config')),
      apiGet(dkUrl('/timetable')).then(d => d.schedule)
    ]);
    const fac = await apiGet(dkUrl('/faculty'));
    fac.forEach(f => _facMap[f.id] = f.name);

    if (_cfg.years.length) _selYear = _cfg.years[0].id;
    if (_cfg.years[0]?.sections?.length) _selSec = _cfg.years[0].sections[0];

    renderPills();
    renderGrid();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  hideLoad();
}

function renderPills() {
  document.getElementById('year-pills').innerHTML =
    _cfg.years.map(y =>
      `<button class="pill ${_selYear===y.id?'active-blue':''}" onclick="selYear(${y.id})">${esc(y.label)}</button>`
    ).join('');

  const yr = _cfg.years.find(y => y.id === _selYear);
  document.getElementById('sec-pills').innerHTML = (yr?.sections||[]).map(s =>
    `<button class="pill ${_selSec===s?'active-amber':''}" onclick="selSec('${s}')">SEC ${s}</button>`
  ).join('');
}

function selYear(y) {
  _selYear = y;
  const yr = _cfg.years.find(yr => yr.id === y);
  if (yr?.sections?.length) _selSec = yr.sections[0];
  renderPills(); renderGrid();
}

function selSec(s) { _selSec = s; renderPills(); renderGrid(); }

function renderGrid() {
  if (!_selYear || !_selSec) return;
  const yr = _cfg.years.find(y => y.id === _selYear);
  document.getElementById('tt-title').textContent =
    `${yearLabel(_selYear).toUpperCase()} — SECTION ${_selSec} — WEEKLY TIMETABLE`;

  document.getElementById('tt-grid').innerHTML = renderSecGrid(_schedule, _selYear, _selSec, _facMap);
  renderLegend();
  updateWAMsg();
}

function renderLegend() {
  const subs = _cfg.subjects?.[_selYear] || _cfg.subjects?.[String(_selYear)] || {theory:[], labs:[]};
  const all  = [...(subs.theory||[]), ...(subs.labs||[]), {name:'Sports'}, {name:'Library'}];
  document.getElementById('legend').innerHTML = all.map(s =>
    `<div class="legend-item" style="background:${subColour(s.name)}">
      <span>${s.importance ? `<span class="imp-dot-${s.importance}"></span>` : ''}${esc(s.name)}</span>
    </div>`
  ).join('');
}

function getCalendarLink() {
  const base = window.location.origin;
  return `${base}/calendar/${Store.deptKey()}/${_selYear}/${_selSec}`;
}

function updateWAMsg() {
  if (!_selYear || !_selSec || !_schedule) {
    document.getElementById('wa-msg').textContent = 'Generate a timetable first, then select year and section.';
    return;
  }
  const link = getCalendarLink();
  const msg  = buildWhatsAppMsg(user.deptName, yearLabel(_selYear), _selSec, link);
  document.getElementById('wa-msg').textContent = msg;
}

function copyWA() {
  const msg = document.getElementById('wa-msg').textContent;
  navigator.clipboard.writeText(msg).then(() => toast('✓ WhatsApp message copied!', 'success'));
}

function copyLink() {
  navigator.clipboard.writeText(getCalendarLink()).then(() => toast('✓ Calendar link copied!', 'success'));
}

function exportICS() {
  if (!_selYear || !_selSec) { toast('Select year and section first', 'error'); return; }
  window.open(dkUrl(`/calendar/ics/${_selYear}/${_selSec}`), '_blank');
  toast('ICS download started', 'info');
}

init();
