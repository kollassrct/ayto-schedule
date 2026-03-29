/* dashboard.js */
if (!requireHOD()) throw new Error('Not authenticated');
buildTopbar('DASHBOARD');

let _cfg = null, _stats = null;

async function init() {
  showLoad('LOADING DASHBOARD...');
  try {
    [_cfg, _stats] = await Promise.all([
      apiGet(dkUrl('/config')),
      apiGet(dkUrl('/stats'))
    ]);
    renderStats();
    renderYearCards();
  } catch(e) { toast('Error loading: ' + e.message, 'error'); }
  hideLoad();
}

function renderStats() {
  document.getElementById('st-sections').textContent = _stats.totalSections;
  document.getElementById('st-faculty').textContent  = _stats.totalFaculty;
  document.getElementById('st-slots').textContent    = _stats.generated ? _stats.totalSlots : '—';

  const stEl = document.getElementById('st-status');
  if (_stats.generated) {
    stEl.textContent = '✓ ACTIVE';
    stEl.style.color = 'var(--success)';
    stEl.style.fontSize = '18px';
  } else {
    stEl.textContent = 'PENDING';
    stEl.style.color = 'var(--warn)';
  }

  const totTh = (_cfg.years||[]).reduce((s,y) => s + ((_cfg.subjects?.[y.id]||_cfg.subjects?.[String(y.id)])?.theory?.length||0), 0);
  const totLb = (_cfg.years||[]).reduce((s,y) => s + ((_cfg.subjects?.[y.id]||_cfg.subjects?.[String(y.id)])?.labs?.length||0),   0);
  document.getElementById('gen-summary').textContent =
    `${_stats.totalFaculty} faculty · ${_stats.totalSections} sections · ${totTh} theory subjects · ${totLb} lab subjects`;

  const btn = document.getElementById('gen-btn');
  btn.textContent = _stats.generated ? '⚡ REGENERATE TIMETABLE' : '⚡ GENERATE TIMETABLE';

  if (_stats.generated) {
    document.getElementById('gen-result').textContent =
      `✓ Active — ${_stats.totalSlots} periods (${_stats.labSlots} lab sessions)`;
  }
}

function renderYearCards() {
  const container = document.getElementById('year-cards');
  container.style.gridTemplateColumns = `repeat(${Math.min(_cfg.years.length, 3)}, 1fr)`;
  container.innerHTML = _cfg.years.map(yr => {
    const subs = _cfg.subjects?.[yr.id] || _cfg.subjects?.[String(yr.id)] || {theory:[], labs:[]};
    return `
    <div class="card">
      <div class="card-title">
        <span style="color:var(--accent)">${esc(yr.label).toUpperCase()}</span>
        <span style="color:var(--muted);font-size:10px">${yr.sections.length} sections</span>
      </div>
      <div style="color:var(--muted);font-size:9px;letter-spacing:1px;font-family:var(--mono);margin-bottom:5px">THEORY</div>
      <div class="flex-row mb-8" style="gap:4px">
        ${(subs.theory||[]).map(s =>
          `<span class="sub-tag" style="background:${subColour(s.name)}">
            <span class="imp-dot-${s.importance}"></span>${esc(s.name)}
           </span>`).join('')}
      </div>
      <div style="color:var(--muted);font-size:9px;letter-spacing:1px;font-family:var(--mono);margin-bottom:5px">LABS</div>
      <div class="flex-row" style="gap:4px">
        ${(subs.labs||[]).map(s =>
          `<span class="sub-tag" style="background:${subColour(s.name)}">${esc(s.name)}</span>`).join('')}
      </div>
      <div style="margin-top:10px;color:var(--muted);font-size:10px;font-family:var(--mono)">
        Sections: ${yr.sections.map(s=>`<span style="color:var(--accent2)">${s}</span>`).join(', ')}
      </div>
    </div>`;
  }).join('');
}

async function generate() {
  showLoad('GENERATING TIMETABLE...');
  try {
    const r = await apiPost(dkUrl('/timetable/generate'), {});
    _stats = await apiGet(dkUrl('/stats'));
    renderStats();
    toast(`✓ Generated — ${r.stats.total} slots scheduled`, 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  hideLoad();
}

init();
