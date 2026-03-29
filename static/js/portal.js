/* portal.js */
if (!requireFaculty()) throw new Error('Not authenticated');

const _user = Store.user();

async function init() {
  showLoad('LOADING YOUR DATA...');
  document.getElementById('portal-name').textContent = _user.name || 'Faculty';

  try {
    const depts = await apiGet('/api/departments');
    const dept  = depts.find(d=>d.key===_user.deptKey);
    document.getElementById('portal-dept').textContent = dept?.name || '';

    const [fac, cfg, tt] = await Promise.all([
      apiGet(`/api/dept/${_user.deptKey}/faculty`),
      apiGet(`/api/dept/${_user.deptKey}/config`),
      apiGet(`/api/dept/${_user.deptKey}/timetable`)
    ]);

    const me = fac.find(f=>f.id===_user.id) || { assignments:[] };
    const sch = tt.schedule;

    // Workload
    let total = 0; const perDay = Array(6).fill(0);
    if (sch) {
      for (const yr of cfg.years) for (const sec of yr.sections) for (let d=0;d<6;d++) for (const p of PERIODS) {
        const sl = (sch[yr.id]||sch[String(yr.id)]||{})[sec]?.[d]?.[p]
                || (sch[yr.id]||sch[String(yr.id)]||{})[sec]?.[String(d)]?.[String(p)];
        if (sl && sl.faculty_id===_user.id && !sl.is_cont) { total++; perDay[d]++; }
      }
    }

    // Stats
    const secs = (me.assignments||[]).reduce((s,a)=>s+a.sections.length,0);
    document.getElementById('p-total').textContent  = total;
    document.getElementById('p-secs').textContent   = secs;
    document.getElementById('p-subjs').textContent  = (me.assignments||[]).length;
    const stEl = document.getElementById('p-status');
    stEl.textContent = sch ? '✓ READY' : 'PENDING';
    stEl.style.color = sch ? 'var(--success)' : 'var(--warn)';

    // Workload bars
    const maxLoad = Math.max(...perDay, 1);
    document.getElementById('wl-bars').innerHTML = perDay.map((cnt,i) => `
      <div class="wl-col">
        <div class="wl-val" style="color:${cnt>3?'var(--danger)':'var(--text)'}">${cnt}</div>
        <div class="wl-bar" style="background:${cnt>3?'var(--danger)':'var(--accent)'};height:${Math.round(cnt/maxLoad*50)+4}px"></div>
        <div class="wl-day">${DAYS_SHORT[i]}</div>
      </div>`).join('');

    // Assignments
    const aEl = document.getElementById('assignments-list');
    if (!(me.assignments||[]).length) {
      aEl.innerHTML = '<span style="color:var(--muted);font-size:12px;font-family:var(--mono)">No assignments yet</span>';
    } else {
      aEl.innerHTML = me.assignments.map(a => `
        <div style="background:${subColour(a.subject)};border-radius:5px;padding:8px 14px">
          <div style="color:#fff;font-weight:700;font-size:12px;font-family:var(--mono)">${esc(a.subject)}</div>
          <div style="color:rgba(255,255,255,.65);font-size:10px;margin-top:2px">${yearLabel(a.year)} · Sec ${a.sections.join(', ')}</div>
        </div>`).join('');
    }

    // Timetable
    document.getElementById('fac-timetable').innerHTML = renderFacGrid(sch, cfg, _user.id);

  } catch(e) { toast('Error loading: ' + e.message, 'error'); }
  hideLoad();
}

init();
