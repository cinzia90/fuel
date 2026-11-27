'use strict';

// ---------------------------------------------------------------------------
// STORAGE pesi/recupero: localStorage sempre; se configurato Supabase, sincronizza
// (iPhone e Apple Watch leggono/scrivono lo stesso cloud).
// ---------------------------------------------------------------------------
const CFG = window.FUEL_CONFIG || {};
const cloudOn = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const LS = 'fuel.v1';

const Store = {
  cache: { w: {}, rec: {} },   // w["exId|set|week"] = peso ; rec[exId] = recupero
  load() {
    try { this.cache = JSON.parse(localStorage.getItem(LS)) || { w: {}, rec: {} }; }
    catch { this.cache = { w: {}, rec: {} }; }
    this.cache.w ||= {}; this.cache.rec ||= {};
  },
  persistLocal() { try { localStorage.setItem(LS, JSON.stringify(this.cache)); } catch {} },
  wKey(exId, set, week) { return exId + '|' + set + '|' + week; },
  getW(exId, set, week) { return this.cache.w[this.wKey(exId, set, week)] ?? ''; },
  setW(exId, set, week, val) {
    const k = this.wKey(exId, set, week);
    if (val === '' || val == null) delete this.cache.w[k]; else this.cache.w[k] = String(val);
    this.persistLocal();
    if (cloudOn) cloudPut('peso', { k, v: val }).catch(() => {});
  },
  getRec(exId, fallback) { return this.cache.rec[exId] ?? (fallback || ''); },
  setRec(exId, val) {
    if (val === '' || val == null) delete this.cache.rec[exId]; else this.cache.rec[exId] = String(val);
    this.persistLocal();
    if (cloudOn) cloudPut('recupero', { k: exId, v: val }).catch(() => {});
  },
  async syncFromCloud() {
    if (!cloudOn) return;
    try {
      const rows = await cloudGet();
      for (const r of rows) {
        if (r.tipo === 'peso') this.cache.w[r.k] = r.v;
        else if (r.tipo === 'recupero') this.cache.rec[r.k] = r.v;
      }
      this.persistLocal();
    } catch (e) { /* offline: resta il locale */ }
  }
};

// REST Supabase (tabella fuel_dati). Shortcut del Watch usa gli stessi endpoint.
function sbHeaders() {
  return { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey, 'Content-Type': 'application/json' };
}
async function cloudGet() {
  const url = CFG.supabaseUrl + '/rest/v1/fuel_dati?owner=eq.' + encodeURIComponent(CFG.owner || 'me') + '&select=tipo,k,v';
  const r = await fetch(url, { headers: sbHeaders() });
  return r.ok ? r.json() : [];
}
async function cloudPut(tipo, { k, v }) {
  const url = CFG.supabaseUrl + '/rest/v1/fuel_dati?on_conflict=owner,tipo,k';
  await fetch(url, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ owner: CFG.owner || 'me', tipo, k, v: v === '' || v == null ? null : String(v) }])
  });
}

// ---------------------------------------------------------------------------
// DATI
// ---------------------------------------------------------------------------
const DATA = {};
async function loadData() {
  const names = ['ciclizzazione', 'alimentazione', 'allenamento', 'integrazione'];
  const res = await Promise.all(names.map(n => fetch('data/' + n + '.json').then(r => r.json())));
  names.forEach((n, i) => DATA[n] = res[i]);
}

// tipo giorno (A/B) da una data
function dayType(date) {
  const r = DATA.ciclizzazione.regola;
  const anc = new Date(r.dataAncora + 'T00:00:00');
  const g = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - anc) / 86400000);
  return r.pattern[((g % r.pattern.length) + r.pattern.length) % r.pattern.length];
}
function todayType() { return dayType(new Date()); }

// parse "3x10", "1x8 + 1x10", "3x8/10" -> array reps per serie
function parseSets(serie) {
  if (!serie) return [];
  const out = [];
  for (const part of serie.split('+')) {
    const m = part.trim().match(/(\d+)\s*x\s*([\d/\-]+)/i);
    if (m) { const n = parseInt(m[1], 10); for (let i = 0; i < n; i++) out.push(m[2]); }
  }
  return out;
}

const WEEKS = 5;
const ESC = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------
// VIEWS
// ---------------------------------------------------------------------------
const view = () => document.getElementById('view');

function setBadge() {
  const t = todayType(); const b = document.getElementById('day-badge');
  b.hidden = false; b.className = 'day-badge ' + t;
  b.textContent = 'Oggi: Giorno ' + t + (t === 'A' ? ' (alto)' : ' (basso)');
}

let oggiSel = null; // 'A'|'B'|'domani' override selezione in Oggi

function renderOggi() {
  const today = todayType();
  const sel = oggiSel || today;
  const type = sel === 'domani' ? dayType(new Date(Date.now() + 86400000)) : sel;
  const g = DATA.alimentazione.giorni[type];
  const pills = [
    { id: null, label: 'Oggi (' + today + ')' },
    { id: today === 'A' ? 'B' : 'A', label: 'Giorno ' + (today === 'A' ? 'B' : 'A') },
    { id: 'domani', label: 'Domani (' + dayType(new Date(Date.now() + 86400000)) + ')' },
  ];
  let h = `<h1 class="page">Alimentazione</h1>`;
  h += `<div class="switcher">` + pills.map(p =>
    `<button class="${(oggiSel || null) === p.id ? 'active' : ''}" data-sel="${p.id ?? ''}">${ESC(p.label)}</button>`).join('') + `</div>`;
  h += `<div class="card"><h2>${ESC(g.nome)}</h2><div class="meta">${ESC(g.sottotitolo)}</div></div>`;
  for (const pasto of g.pasti) {
    h += `<div class="card meal"><h2>${ESC(pasto.nome)}</h2>`;
    h += macroBlock('Proteine', pasto.proteine);
    h += macroBlock('Carboidrati', pasto.carboidrati);
    h += macroBlock('Grassi', pasto.grassi);
    h += `</div>`;
  }
  h += `<p class="eaa">${ESC(DATA.alimentazione.eaa)}</p>`;
  view().innerHTML = h;
  view().querySelectorAll('.switcher button').forEach(b =>
    b.onclick = () => { oggiSel = b.dataset.sel || null; renderOggi(); });
}
function macroBlock(label, items) {
  if (!items || !items.length) return '';
  return `<div class="macro"><div class="label">${label}</div><ul>` +
    items.map(x => `<li>${ESC(x)}</li>`).join('') +
    `</ul></div>`;
}

let selGiorno = null; // giorno allenamento scelto (oggetto) o null = scelta

function renderAllenamento() {
  if (!selGiorno) {
    let h = `<h1 class="page">Allenamento</h1><p class="sub">Scegli il giorno.</p><div class="daypick">`;
    for (const d of DATA.allenamento.giorni) {
      const parts = d.nome.split(' '); const g = parts[0]; const rest = parts.slice(1).join(' ');
      h += `<button data-g="${d.id}"><span class="g">${ESC(g)}</span><span class="n">${ESC(rest)}</span><span class="f">${ESC(d.focus)}</span></button>`;
    }
    h += `</div>`;
    // complementare
    const c = DATA.allenamento.complementare;
    h += `<div class="card"><h2>${ESC(c.titolo)}</h2><div class="meta">${ESC(c.sottotitolo)}</div>`;
    for (const v of c.voci) h += `<div class="intg"><span class="n">${ESC(v.nome)}</span><span class="dose">${ESC(v.volume)} · ${ESC(v.note)}</span></div>`;
    h += `</div>`;
    view().innerHTML = h;
    view().querySelectorAll('.daypick button').forEach(b =>
      b.onclick = () => { selGiorno = DATA.allenamento.giorni.find(x => x.id === b.dataset.g); renderAllenamento(); });
    return;
  }
  const d = selGiorno;
  let h = `<button class="backlink" id="back">&larr; Giorni</button>`;
  h += `<h1 class="page">${ESC(d.nome)}</h1><p class="sub">${ESC(d.focus)}</p>`;
  for (const ex of d.esercizi) h += exerciseCard(ex);
  view().innerHTML = h;
  document.getElementById('back').onclick = () => { selGiorno = null; renderAllenamento(); };
  wireExercise(view(), d.esercizi);
}

function exerciseCard(ex) {
  const sets = parseSets(ex.serie);
  const img = ex.immagine
    ? `<img src="${ESC(ex.immagine)}" alt="" loading="lazy" />`
    : `<span class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M4 8.5v7M17.5 6.5v11M20 8.5v7M6.5 12h11"/></svg></span>`;
  let h = `<div class="ex" data-ex="${ex.id}">`;
  h += `<div class="ex-top"><div class="ex-img">${img}</div><div class="ex-info">`;
  h += `<div class="name">${ESC(ex.nome)}</div>`;
  if (ex.serie) h += `<div class="serie">${ESC(ex.serie)}</div>`;
  h += `</div></div>`;
  if (ex.note) h += `<div class="ex-note">${ESC(ex.note)}</div>`;
  h += `<div class="ex-rec"><label>Recupero</label><input type="text" inputmode="numeric" placeholder="es. 90s" data-rec="${ex.id}" value="${ESC(Store.getRec(ex.id, ex.recupero))}" /></div>`;
  if (sets.length) {
    h += `<div class="grid-title">Pesi · settimana per settimana</div>`;
    h += `<table class="grid"><thead><tr><th></th>`;
    for (let w = 1; w <= WEEKS; w++) h += `<th>${w}&ordf;</th>`;
    h += `</tr></thead><tbody>`;
    sets.forEach((reps, si) => {
      h += `<tr><td class="sethdr">S${si + 1}&middot;${ESC(reps)}</td>`;
      for (let w = 1; w <= WEEKS; w++)
        h += `<td><input type="number" inputmode="decimal" data-w="${ex.id}|${si}|${w}" value="${ESC(Store.getW(ex.id, si, w))}" /></td>`;
      h += `</tr>`;
    });
    h += `</tbody></table><div class="saved-flash" data-flash="${ex.id}"></div>`;
  }
  h += `</div>`;
  return h;
}

function wireExercise(root) {
  root.querySelectorAll('input[data-w]').forEach(inp => {
    inp.addEventListener('change', () => {
      const [exId, set, week] = inp.dataset.w.split('|');
      Store.setW(exId, parseInt(set, 10), parseInt(week, 10), inp.value.trim());
      flash(exId);
    });
  });
  root.querySelectorAll('input[data-rec]').forEach(inp => {
    inp.addEventListener('change', () => { Store.setRec(inp.dataset.rec, inp.value.trim()); flash(inp.dataset.rec); });
  });
}
function flash(exId) {
  const el = view().querySelector(`[data-flash="${exId}"]`);
  if (!el) return; el.textContent = cloudOn ? '✓ Salvato (sincronizzato)' : '✓ Salvato';
  clearTimeout(el._t); el._t = setTimeout(() => el.textContent = '', 1500);
}

function renderNote() {
  const n = DATA.alimentazione.noteImportanti;
  const labels = { idratazione: 'Idratazione', sale: 'Sale', verdure: 'Verdure', dolcificantiEBevandeZero: 'Dolcificanti & bevande zero', approccio: 'Approccio' };
  let h = `<h1 class="page">Note & Integrazione</h1>`;
  h += `<div class="card"><h2>Note importanti</h2><ul class="nlist">`;
  for (const k in labels) if (n[k]) h += `<li><div class="t">${labels[k]}</div><div class="d">${ESC(n[k])}</div></li>`;
  h += `</ul></div>`;
  h += `<div class="card"><h2>Integrazione consigliata</h2>`;
  for (const it of DATA.integrazione.integratori)
    h += `<div class="intg"><span class="n">${ESC(it.nome)}</span><span class="dose">${ESC(it.dosaggio)}</span></div>`;
  h += `</div>`;
  const en = DATA.allenamento.noteEsecutive;
  h += `<div class="card"><h2>Note esecutive</h2><ul class="nlist">`;
  h += `<li><div class="t">Serie di avvicinamento</div><div class="d">${ESC(en.serieDiAvvicinamento)}</div></li>`;
  h += `<li><div class="t">Carico interno</div><div class="d">${ESC(en.caricoInterno)}</div></li>`;
  h += `<li><div class="t">Recupero</div><div class="d">${ESC(en.recupero)}</div></li>`;
  h += `</ul></div>`;
  view().innerHTML = h;
}

// ---------------------------------------------------------------------------
// NAV
// ---------------------------------------------------------------------------
const TABS = { oggi: renderOggi, allenamento: renderAllenamento, note: renderNote };
function go(tab) {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.tab === tab ? 'true' : 'false'));
  (TABS[tab] || renderOggi)();
  try { localStorage.setItem('fuel.tab', tab); } catch {}
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => go(t.dataset.tab));

(async function init() {
  Store.load();
  try {
    await loadData();
  } catch (e) {
    view().innerHTML = '<div class="loading">Errore nel caricamento dei dati.</div>';
    return;
  }
  setBadge();
  await Store.syncFromCloud();
  let tab = 'oggi'; try { tab = localStorage.getItem('fuel.tab') || 'oggi'; } catch {}
  go(tab);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
