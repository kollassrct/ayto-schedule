/* config.js */
if (!requireHOD()) throw new Error('Not authenticated');
buildTopbar('CONFIG');

let _orig = null, _draft = null, _secYear = null, _subjYear = null;

async function init() {
  showLoad('LOADING CONFIG...');
  try {
    _orig  = await apiGet(dkUrl('/config'));
    _draft = JSON.parse(JSON.stringify(_orig));
    _secYear  = _draft.years[0]?.id || null;
    _subjYear = _draft.years[0]?.id || null;
    render();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  hideLoad();
}

function render() {
  renderYears();
  renderSecTabs();
  renderSecList();
  renderSubjTabs();
  renderSubjEditor();
}

// ── YEARS ─────────────────────────────────────────────────────────
function renderYears() {
  document.getElementById('year-list').innerHTML = _draft.years.map((y,i) =>
    `<div style="background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:8px 12px;display:flex;align-items:center;gap:8px">
      <span style="color:var(--accent);font-family:var(--mono);font-size:12px">${esc(y.label)}</span>
      <button class="btn btn-sm btn-danger" onclick="rmYear(${i})">✕</button>
    </div>`
  ).join('');
}

function addYear() {
  const id  = parseInt(document.getElementById('ny-id').value);
  const lbl = document.getElementById('ny-lbl').value.trim();
  if (!id || !lbl) { toast('Enter year ID and label', 'error'); return; }
  if (_draft.years.find(y=>y.id===id)) { toast('Year already exists', 'error'); return; }
  _draft.years.push({ id, label: lbl, sections: [] });
  if (!_draft.subjects) _draft.subjects = {};
  _draft.subjects[id] = { theory: [], labs: [] };
  document.getElementById('ny-id').value = '';
  document.getElementById('ny-lbl').value = '';
  render();
}

function rmYear(i) {
  const y = _draft.years[i];
  _draft.years.splice(i, 1);
  if (_draft.subjects) delete _draft.subjects[y.id];
  if (_secYear  === y.id) _secYear  = _draft.years[0]?.id || null;
  if (_subjYear === y.id) _subjYear = _draft.years[0]?.id || null;
  render();
}

// ── SECTIONS ──────────────────────────────────────────────────────
function renderSecTabs() {
  document.getElementById('sec-year-tabs').innerHTML = _draft.years.map(y =>
    `<button class="pill ${_secYear===y.id?'active-blue':''}" onclick="setSecYear(${y.id})">${esc(y.label)}</button>`
  ).join('');
}

function renderSecList() {
  const yr = _draft.years.find(y=>y.id===_secYear);
  if (!yr) { document.getElementById('sec-list').innerHTML = '<span style="color:var(--muted);font-size:11px;font-family:var(--mono)">Select a year first</span>'; return; }
  document.getElementById('sec-list').innerHTML = (yr.sections||[]).map((s,i) =>
    `<div style="background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:6px 12px;display:flex;align-items:center;gap:8px">
      <span style="color:var(--accent2);font-family:var(--mono);font-weight:bold">${esc(s)}</span>
      <button class="btn btn-sm btn-danger" onclick="rmSec(${i})">✕</button>
    </div>`
  ).join('') || '<span style="color:var(--muted);font-size:11px;font-family:var(--mono)">No sections yet</span>';
}

function setSecYear(id) { _secYear = id; renderSecTabs(); renderSecList(); }

function addSec() {
  const s = document.getElementById('ns-sec').value.trim().toUpperCase();
  if (!s) { toast('Enter section name', 'error'); return; }
  const yr = _draft.years.find(y=>y.id===_secYear);
  if (!yr) { toast('Select a year first', 'error'); return; }
  if (!yr.sections) yr.sections = [];
  if (yr.sections.includes(s)) { toast('Section already exists', 'error'); return; }
  yr.sections.push(s);
  document.getElementById('ns-sec').value = '';
  renderSecList();
}

function rmSec(i) {
  const yr = _draft.years.find(y=>y.id===_secYear);
  if (yr) { yr.sections.splice(i,1); renderSecList(); }
}

// ── SUBJECTS ──────────────────────────────────────────────────────
function renderSubjTabs() {
  document.getElementById('subj-year-tabs').innerHTML = _draft.years.map(y =>
    `<button class="pill ${_subjYear===y.id?'active-blue':''}" onclick="setSubjYear(${y.id})">${esc(y.label)}</button>`
  ).join('');
}

function setSubjYear(id) { _subjYear = id; renderSubjTabs(); renderSubjEditor(); }

function renderSubjEditor() {
  const yid = _subjYear;
  if (!yid) { document.getElementById('subj-editor').innerHTML = '<div class="empty-state">Add a year first</div>'; return; }
  if (!_draft.subjects) _draft.subjects = {};
  if (!_draft.subjects[yid]) _draft.subjects[yid] = { theory: [], labs: [] };
  const subs = _draft.subjects[yid];
  const yr   = _draft.years.find(y=>y.id===yid);

  document.getElementById('subj-editor').innerHTML = `
    <div class="year-block">
      <div class="year-block-title">
        <span style="color:var(--accent2)">${esc(yr?.label||yid)}</span>
        <span style="color:var(--muted);font-size:10px">${(subs.theory||[]).length} theory · ${(subs.labs||[]).length} labs</span>
      </div>
      ${renderSubList(subs.theory||[], 'theory', yid)}
      <hr class="divider"/>
      ${renderSubList(subs.labs||[], 'labs', yid)}
    </div>`;
}

function renderSubList(list, type, yid) {
  const label = type === 'theory' ? 'THEORY SUBJECTS' : 'LAB SUBJECTS';
  return `
    <div style="margin-bottom:10px">
      <div style="color:var(--muted);font-size:9px;letter-spacing:1px;font-family:var(--mono);margin-bottom:6px">${label}</div>
      ${list.map((s,i) => `
        <div class="subj-row">
          <span class="subj-row-name">${esc(s.name)}</span>
          <select class="form-select" onchange="setImp(${yid},'${type}',${i},this.value)" style="font-size:10px;padding:4px 8px">
            ${IMP_ORDER.map(imp=>`<option value="${imp}" ${s.importance===imp?'selected':''}>${imp.toUpperCase()} (${IMP_PW[imp]}p/wk)</option>`).join('')}
          </select>
          <span class="imp-${s.importance}" style="min-width:68px;text-align:center;font-size:10px">${s.importance.toUpperCase()}</span>
          <span style="color:var(--muted);font-size:10px;font-family:var(--mono);width:60px;text-align:right">${s.periodsPerWeek||IMP_PW[s.importance]}p/wk</span>
          <button class="btn btn-sm btn-danger" onclick="rmSub(${yid},'${type}',${i})">✕</button>
        </div>`).join('') || `<div style="color:var(--muted);font-size:11px;font-family:var(--mono);margin-bottom:8px">No ${type} subjects</div>`}
      <div class="flex-row mt-8">
        <input class="form-input" id="nss-${type}" style="flex:1" placeholder="${type==='theory'?'Subject name e.g. ADA':'Lab name e.g. DS Lab'}"/>
        <select class="form-select" id="nsi-${type}">
          ${IMP_ORDER.map(imp=>`<option value="${imp}">${imp.toUpperCase()}</option>`).join('')}
        </select>
        <button class="btn btn-success" onclick="addSub(${yid},'${type}')">+ ADD</button>
      </div>
    </div>`;
}

function addSub(yid, type) {
  const name = document.getElementById(`nss-${type}`).value.trim();
  const imp  = document.getElementById(`nsi-${type}`).value;
  if (!name) { toast('Enter subject name', 'error'); return; }
  if (!_draft.subjects[yid]) _draft.subjects[yid] = { theory:[], labs:[] };
  const list = type==='theory' ? _draft.subjects[yid].theory : _draft.subjects[yid].labs;
  if (list.find(s=>s.name===name)) { toast('Subject already exists', 'error'); return; }
  list.push({ name, importance: imp, periodsPerWeek: IMP_PW[imp] });
  document.getElementById(`nss-${type}`).value = '';
  renderSubjEditor();
}

function rmSub(yid, type, i) {
  const list = type==='theory' ? _draft.subjects[yid].theory : _draft.subjects[yid].labs;
  list.splice(i, 1); renderSubjEditor();
}

function setImp(yid, type, i, val) {
  const list = type==='theory' ? _draft.subjects[yid].theory : _draft.subjects[yid].labs;
  list[i].importance = val; list[i].periodsPerWeek = IMP_PW[val]; renderSubjEditor();
}

function resetCfg() { _draft = JSON.parse(JSON.stringify(_orig)); _secYear = _draft.years[0]?.id||null; _subjYear = _draft.years[0]?.id||null; render(); toast('Reset to saved config', 'info'); }

async function saveCfg() {
  showLoad('SAVING CONFIG...');
  try {
    await apiPut(dkUrl('/config'), _draft);
    _orig = JSON.parse(JSON.stringify(_draft));
    toast('Config saved! Generate a new timetable from Dashboard.', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  hideLoad();
}

init();
