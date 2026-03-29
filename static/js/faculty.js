/* faculty.js */
if (!requireHOD()) throw new Error('Not authenticated');
buildTopbar('FACULTY');

let _fac = [], _cfg = null, _sch = null, _viewFid = null, _delFid = null;
let _draft = null, _ndSecs = [];

async function init() {
  showLoad('LOADING FACULTY...');
  try {
    [_fac, _cfg, _sch] = await Promise.all([
      apiGet(dkUrl('/faculty')),
      apiGet(dkUrl('/config')),
      apiGet(dkUrl('/timetable')).then(d => d.schedule)
    ]);
    render();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  hideLoad();
}

function getWorkload(fid) {
  if (!_sch || !_cfg) return { total: 0, perDay: Array(6).fill(0) };
  let total = 0; const perDay = Array(6).fill(0);
  for (const yr of _cfg.years) for (const sec of yr.sections) for (let d=0;d<6;d++) for (const p of PERIODS) {
    const sl = (_sch[yr.id]||_sch[String(yr.id)]||{})[sec]?.[d]?.[p]
            || (_sch[yr.id]||_sch[String(yr.id)]||{})[sec]?.[String(d)]?.[String(p)];
    if (sl && sl.faculty_id === fid && !sl.is_cont) { total++; perDay[d]++; }
  }
  return { total, perDay };
}

function render() {
  document.getElementById('fac-count').textContent = `FACULTY ROSTER — ${_fac.length} MEMBERS`;
  const tbody = document.getElementById('fac-tbody');
  if (!_fac.length) { tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No faculty added yet</td></tr>`; return; }

  tbody.innerHTML = _fac.map(f => {
    const w    = getWorkload(f.id);
    const yrs  = [...new Set((f.assignments||[]).map(a=>a.year))].map(y=>`Y${y}`).join(', ');
    const over = w.total > 24;
    return `
    <tr>
      <td style="color:var(--accent);font-weight:bold">${f.id}</td>
      <td style="color:var(--bright);font-weight:bold">${esc(f.name)}</td>
      <td style="font-family:var(--mono)">${yrs || '—'}</td>
      <td>${(f.assignments||[]).map(a=>`<span class="sub-tag" style="background:${subColour(a.subject)}">${esc(a.subject)}</span>`).join('') || '—'}</td>
      <td style="font-family:var(--mono)">${(f.assignments||[]).map(a=>a.sections.join('')).join(' | ') || '—'}</td>
      <td>
        <span style="color:${over?'var(--danger)':w.total>18?'var(--warn)':'var(--success)'};font-weight:bold;font-size:16px;font-family:var(--mono)">${w.total}</span>
        <span style="color:var(--muted);font-size:10px"> / 36</span>
        ${over ? `<div style="color:var(--danger);font-size:9px;font-family:var(--mono)">⚠ OVERLOAD</div>` : ''}
      </td>
      <td>
        <div class="flex-row" style="gap:4px;flex-wrap:nowrap">
          <button class="btn btn-sm btn-primary" onclick="openEdit('${f.id}')">EDIT</button>
          <button class="btn btn-sm ${_viewFid===f.id?'btn-warn':'btn-secondary'}" onclick="toggleView('${f.id}')">${_viewFid===f.id?'HIDE':'VIEW'}</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDel('${f.id}')">${_delFid===f.id?'CONFIRM?':'DEL'}</button>
          ${_delFid===f.id ? `
            <button class="btn btn-sm" style="background:var(--danger);color:#fff;border:none" onclick="doDel('${f.id}')">YES</button>
            <button class="btn btn-sm btn-secondary" onclick="cancelDel()">NO</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  // View panel
  if (_viewFid) {
    const f = _fac.find(x => x.id === _viewFid);
    const w = getWorkload(_viewFid);
    document.getElementById('view-panel').style.display = 'block';
    document.getElementById('view-title').innerHTML =
      `<span>TIMETABLE: ${esc(f?.name||'')} &nbsp;·&nbsp; Total: ${w.total} periods/week</span>`;
    document.getElementById('view-grid').innerHTML = renderFacGrid(_sch, _cfg, _viewFid);
  } else {
    document.getElementById('view-panel').style.display = 'none';
  }
}

function toggleView(fid) { _viewFid = _viewFid === fid ? null : fid; render(); }
function confirmDel(fid) { _delFid = fid; render(); }
function cancelDel()     { _delFid = null; render(); }

async function doDel(fid) {
  showLoad('REMOVING...');
  try {
    await apiDel(dkUrl(`/faculty/${fid}`));
    _delFid = null; _viewFid = null;
    [_fac, _sch] = await Promise.all([
      apiGet(dkUrl('/faculty')),
      apiPost(dkUrl('/timetable/generate'), {}).then(() => apiGet(dkUrl('/timetable'))).then(d=>d.schedule)
    ]);
    render(); toast('Faculty removed', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  hideLoad();
}

// ── MODAL ─────────────────────────────────────────────────────────
function openModal() { const b = document.getElementById('modal-backdrop'); b.style.display='flex'; setTimeout(()=>b.classList.add('open'),10); }
function closeModal(){ const b = document.getElementById('modal-backdrop'); b.classList.remove('open'); setTimeout(()=>b.style.display='none',200); _draft=null; }
function modalBg(e)  { if(e.target===document.getElementById('modal-backdrop')) closeModal(); }

function openAdd() {
  _draft = { id:'__new__', name:'', assignments:[] }; _ndSecs = [];
  document.getElementById('modal-title').textContent = 'ADD NEW FACULTY';
  renderModal(); openModal();
}
function openEdit(fid) {
  const f = _fac.find(x=>x.id===fid); if(!f) return;
  _draft = JSON.parse(JSON.stringify(f)); _ndSecs = [];
  document.getElementById('modal-title').textContent = 'EDIT FACULTY';
  renderModal(); openModal();
}

function getAllSubs() {
  if (!_cfg) return [];
  return _cfg.years.flatMap(y => {
    const subs = _cfg.subjects?.[y.id] || _cfg.subjects?.[String(y.id)] || {theory:[],labs:[]};
    return [...(subs.theory||[]), ...(subs.labs||[])].map(s => ({year:y.id, yearLabel:y.label, name:s.name}));
  });
}

function renderModal() {
  const f = _draft;
  const secList = _cfg?.sections || _cfg?.years?.flatMap(y=>y.sections).filter((v,i,a)=>a.indexOf(v)===i) || [];
  const yearList = _cfg?.years || [];

  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">FACULTY NAME</label>
      <input class="form-input" id="md-name" value="${esc(f.name)}" placeholder="Full name e.g. Dr. K. Ravi"/>
    </div>

    <label class="form-label" style="margin-bottom:7px">CURRENT ASSIGNMENTS</label>
    <div id="md-asgns">
      ${(f.assignments||[]).length===0 ? '<div style="color:var(--muted);font-size:11px;font-family:var(--mono);margin-bottom:8px">No assignments yet</div>' : ''}
      ${(f.assignments||[]).map((a,i)=>`
        <div class="asgn-item">
          <div class="flex-row" style="justify-content:space-between;margin-bottom:7px">
            <div>
              <span class="sub-tag" style="background:${subColour(a.subject)};margin-right:6px">${esc(a.subject)}</span>
              <span style="color:var(--text);font-size:11px;font-family:var(--mono)">${yearLabel(a.year)}</span>
            </div>
            <button class="btn btn-sm btn-danger" onclick="rmAsgn(${i})">REMOVE</button>
          </div>
          <div class="flex-row" style="gap:5px;flex-wrap:wrap">
            ${((_cfg.years.find(y=>y.id===a.year)||{}).sections||[]).map(sec=>
              `<button class="sec-toggle ${a.sections.includes(sec)?'on':''}" onclick="togSec(${i},'${sec}')">${sec}</button>`
            ).join('')}
          </div>
        </div>`).join('')}
    </div>

    <div style="background:#080f1e;border:1px dashed var(--border);border-radius:5px;padding:14px;margin:10px 0 18px">
      <div style="color:var(--accent2);font-size:10px;letter-spacing:1px;font-family:var(--mono);margin-bottom:10px">+ ADD NEW ASSIGNMENT</div>
      <div class="flex-row mb-8">
        <select class="form-select" id="nd-year" onchange="updateSubList()" style="flex:0 0 130px">
          ${yearList.map(y=>`<option value="${y.id}">${esc(y.label)}</option>`).join('')}
        </select>
        <select class="form-select" id="nd-sub" style="flex:1">
          ${(()=>{ const y=yearList[0]; if(!y) return ''; const sb=_cfg.subjects?.[y.id]||_cfg.subjects?.[String(y.id)]||{theory:[],labs:[]}; return [...(sb.theory||[]),...(sb.labs||[])].map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join(''); })()}
        </select>
      </div>
      <div class="flex-row mb-8" id="nd-secs" style="gap:5px;flex-wrap:wrap">
        ${(yearList[0]?.sections||[]).map(sec=>
          `<button class="sec-toggle ${_ndSecs.includes(sec)?'on':''}" id="nds-${sec}" onclick="togNdSec('${sec}')">${sec}</button>`
        ).join('')}
      </div>
      <button class="btn btn-success" onclick="addAsgn()">ADD ASSIGNMENT</button>
    </div>

    <div class="flex-row flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">CANCEL</button>
      <button class="btn btn-primary" style="padding:9px 24px" onclick="saveModal()">${f.id==='__new__'?'CREATE FACULTY':'SAVE CHANGES'}</button>
    </div>`;
}

function updateSubList() {
  const y   = parseInt(document.getElementById('nd-year').value);
  const sel = document.getElementById('nd-sub');
  const sb  = _cfg.subjects?.[y] || _cfg.subjects?.[String(y)] || {theory:[],labs:[]};
  sel.innerHTML = [...(sb.theory||[]),...(sb.labs||[])].map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');

  const yr = _cfg.years.find(yr=>yr.id===y);
  document.getElementById('nd-secs').innerHTML = (yr?.sections||[]).map(sec=>
    `<button class="sec-toggle ${_ndSecs.includes(sec)?'on':''}" id="nds-${sec}" onclick="togNdSec('${sec}')">${sec}</button>`
  ).join('');
}

function syncName() { const el=document.getElementById('md-name'); if(el&&el.value.trim()) _draft.name=el.value; }
function rmAsgn(i)  { syncName(); _draft.assignments.splice(i,1); renderModal(); }
function togSec(idx,sec) {
  syncName();
  const a = _draft.assignments[idx];
  const i = a.sections.indexOf(sec);
  if (i>=0) a.sections.splice(i,1); else a.sections.push(sec);
  a.sections.sort(); renderModal();
}
function togNdSec(sec) {
  const i = _ndSecs.indexOf(sec);
  if (i>=0) _ndSecs.splice(i,1); else _ndSecs.push(sec);
  _ndSecs.sort();
  document.querySelectorAll('[id^="nds-"]').forEach(btn => {
    btn.className = 'sec-toggle' + (_ndSecs.includes(btn.textContent.trim()) ? ' on' : '');
  });
}
function addAsgn() {
  syncName();
  const year    = parseInt(document.getElementById('nd-year').value);
  const subject = document.getElementById('nd-sub').value;
  if (!_ndSecs.length) { toast('Select at least one section', 'error'); return; }
  _draft.assignments.push({ year, subject, sections: [..._ndSecs] });
  _ndSecs = []; renderModal();
}

async function saveModal() {
  const name = document.getElementById('md-name').value.trim();
  if (!name) { toast('Faculty name required', 'error'); return; }
  _draft.name = name;
  const sid = _draft.id, sname = _draft.name, sasgns = JSON.parse(JSON.stringify(_draft.assignments));
  const isNew = sid === '__new__';
  closeModal();
  showLoad(isNew ? 'ADDING FACULTY...' : 'SAVING...');
  try {
    if (isNew) await apiPost(dkUrl('/faculty'), { name: sname, assignments: sasgns });
    else       await apiPut(dkUrl(`/faculty/${sid}`), { name: sname, assignments: sasgns });
    [_fac, _sch] = await Promise.all([
      apiGet(dkUrl('/faculty')),
      apiPost(dkUrl('/timetable/generate'),{}).then(()=>apiGet(dkUrl('/timetable'))).then(d=>d.schedule)
    ]);
    render(); toast(isNew ? 'Faculty added!' : `"${sname}" saved`, 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
  hideLoad();
}

init();
