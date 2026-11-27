'use strict';

// ---------------------------------------------------------------------------
// STORAGE: localStorage + (se configurato) Supabase, cosi iPhone e Apple Watch
// condividono gli stessi valori. Modello generico: v["exId|campo"] = testo.
// campo = 'recupero' | 'ultimo' | 'w1'..'wN'. I valori iniziali (nota pesi)
// vivono nei dati; qui si salvano solo le MODIFICHE (override).
// ---------------------------------------------------------------------------
const CFG = window.FUEL_CONFIG || {};
const cloudOn = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
const LS = 'fuel.v2';

const Store = {
  v: {},
  load() { try { this.v = JSON.parse(localStorage.getItem(LS)) || {}; } catch { this.v = {}; } if (!this.v || typeof this.v !== 'object') this.v = {}; },
  persist() { try { localStorage.setItem(LS, JSON.stringify(this.v)); } catch {} },
  key(exId, field) { return exId + '|' + field; },
  has(exId, field) { return Object.prototype.hasOwnProperty.call(this.v, this.key(exId, field)); },
  raw(exId, field) { return this.v[this.key(exId, field)]; },
  set(exId, field, val) {
    this.v[this.key(exId, field)] = val;   // salva anche '' = override esplicito
    this.persist();
    if (cloudOn) cloudPut(this.key(exId, field), val).catch(() => {});
  },
  async syncFromCloud() {
    if (!cloudOn) return;
    try { const rows = await cloudGet(); for (const r of rows) this.v[r.k] = r.v ?? ''; this.persist(); } catch {}
  }
};

// valore da mostrare: override utente se presente, altrimenti il dato iniziale
function displayVal(ex, field) {
  if (Store.has(ex.id, field)) return Store.raw(ex.id, field) ?? '';
  if (field === 'recupero') return ex.recupero || '';
  if (field === 'ultimo') return ex.ultimo || '';
  if (field[0] === 'w') { const n = field.slice(1); return (ex.settimane && ex.settimane[n]) || ''; }
  return '';
}

function sbHeaders() { return { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey, 'Content-Type': 'application/json' }; }
async function cloudGet() {
  const url = CFG.supabaseUrl + '/rest/v1/fuel_dati?owner=eq.' + encodeURIComponent(CFG.owner || 'me') + '&select=k,v';
  const r = await fetch(url, { headers: sbHeaders() }); return r.ok ? r.json() : [];
}
async function cloudPut(k, v) {
  const url = CFG.supabaseUrl + '/rest/v1/fuel_dati?on_conflict=owner,k';
  await fetch(url, { method: 'POST', headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ owner: CFG.owner || 'me', k, v: (v === '' || v == null) ? null : String(v) }]) });
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
function dayType(date) {
  const r = DATA.ciclizzazione.regola;
  const anc = new Date(r.dataAncora + 'T00:00:00');
  const g = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - anc) / 86400000);
  return r.pattern[((g % r.pattern.length) + r.pattern.length) % r.pattern.length];
}
function todayType() { return dayType(new Date()); }

const ESC = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const view = () => document.getElementById('view');

function setBadge() {
  const t = todayType(); const b = document.getElementById('day-badge');
  b.hidden = false; b.className = 'day-badge ' + t;
  b.textContent = 'Oggi: Giorno ' + t + (t === 'A' ? ' (alto)' : ' (basso)');
}

// ---- OGGI ----
let oggiSel = null;
function renderOggi() {
  const today = todayType();
  const type = oggiSel === 'domani' ? dayType(new Date(Date.now() + 86400000)) : (oggiSel || today);
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
    h += macroBlock('Proteine', pasto.proteine) + macroBlock('Carboidrati', pasto.carboidrati) + macroBlock('Grassi', pasto.grassi);
    h += `</div>`;
  }
  h += `<p class="eaa">${ESC(DATA.alimentazione.eaa)}</p>`;
  view().innerHTML = h;
  view().querySelectorAll('.switcher button').forEach(b => b.onclick = () => { oggiSel = b.dataset.sel || null; renderOggi(); });
}
function macroBlock(label, items) {
  if (!items || !items.length) return '';
  return `<div class="macro"><div class="label">${label}</div><ul>` + items.map(x => `<li>${ESC(x)}</li>`).join('') + `</ul></div>`;
}

// ---- ALLENAMENTO ----
let selGiorno = null;
function renderAllenamento() {
  if (!selGiorno) {
    let h = `<h1 class="page">Allenamento</h1><p class="sub">Scegli il giorno.</p><div class="daypick">`;
    for (const d of DATA.allenamento.giorni) {
      const parts = d.nome.split(' '); const g = parts[0]; const rest = parts.slice(1).join(' ');
      h += `<button data-g="${d.id}"><span class="g">${ESC(g)}</span><span class="n">${ESC(rest)}</span><span class="f">${ESC(d.focus)}</span></button>`;
    }
    h += `</div>`;
    const c = DATA.allenamento.complementare;
    h += `<div class="card"><h2>${ESC(c.titolo)}</h2><div class="meta">${ESC(c.sottotitolo)}</div>`;
    for (const v of c.voci) h += `<div class="intg"><span class="n">${ESC(v.nome)}</span><span class="dose">${ESC(v.volume)} &middot; ${ESC(v.note)}</span></div>`;
    h += `</div>`;
    view().innerHTML = h;
    view().querySelectorAll('.daypick button').forEach(b => b.onclick = () => { selGiorno = DATA.allenamento.giorni.find(x => x.id === b.dataset.g); window.scrollTo(0, 0); renderAllenamento(); });
    return;
  }
  const d = selGiorno;
  let h = `<button class="backlink" id="back">&larr; Giorni</button>`;
  h += `<h1 class="page">${ESC(d.nome)}</h1><p class="sub">${ESC(d.focus)}</p>`;
  for (const ex of d.esercizi) h += exerciseCard(ex);
  view().innerHTML = h;
  document.getElementById('back').onclick = () => { selGiorno = null; window.scrollTo(0, 0); renderAllenamento(); };
  wireExercise(view());
}

const DUMBBELL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M4 8.5v7M17.5 6.5v11M20 8.5v7M6.5 12h11"/></svg>`;
function exerciseCard(ex) {
  const count = DATA.allenamento.settimaneCount || 4;
  const img = ex.immagine ? `<img src="${ESC(ex.immagine)}" alt="" />` : `<span class="ph">${DUMBBELL}</span>`;
  let h = `<div class="ex" data-ex="${ex.id}">`;
  h += `<div class="ex-top"><div class="ex-img">${img}</div><div class="ex-info">`;
  h += `<div class="name">${ESC(ex.nome)}</div>`;
  if (ex.serie) h += `<div class="serie">${ESC(ex.serie)}</div>`;
  h += `</div></div>`;
  if (ex.note) h += `<div class="ex-note">${ESC(ex.note)}</div>`;
  h += `<div class="ex-rec"><label>Recupero</label><input type="text" data-f="recupero" placeholder="es. 90s" value="${ESC(displayVal(ex, 'recupero'))}" /></div>`;
  h += `<div class="grid-title">Pesi &middot; settimana per settimana</div>`;
  h += `<div class="wrow ultimo"><span class="wlab">Ultimo</span><input type="text" data-f="ultimo" class="winput ref" placeholder="&mdash;" value="${ESC(displayVal(ex, 'ultimo'))}" /></div>`;
  for (let w = 1; w <= count; w++)
    h += `<div class="wrow"><span class="wlab">S${w}</span><input type="text" data-f="w${w}" class="winput" placeholder="&mdash;" value="${ESC(displayVal(ex, 'w' + w))}" /></div>`;
  h += `<div class="saved-flash" data-flash="${ex.id}"></div></div>`;
  return h;
}
function wireExercise(root) {
  root.querySelectorAll('.ex input[data-f]').forEach(inp => {
    inp.addEventListener('change', () => {
      const exId = inp.closest('.ex').dataset.ex;
      Store.set(exId, inp.dataset.f, inp.value.trim());
      flash(exId);
    });
  });
}
function flash(exId) {
  const el = view().querySelector(`[data-flash="${exId}"]`);
  if (!el) return; el.textContent = cloudOn ? '✓ Salvato (sincronizzato)' : '✓ Salvato';
  clearTimeout(el._t); el._t = setTimeout(() => el.textContent = '', 1500);
}

// ---- NOTE ----
function renderNote() {
  const n = DATA.alimentazione.noteImportanti;
  const labels = { idratazione: 'Idratazione', sale: 'Sale', verdure: 'Verdure', dolcificantiEBevandeZero: 'Dolcificanti & bevande zero', approccio: 'Approccio' };
  let h = `<h1 class="page">Note & Integrazione</h1>`;
  h += `<div class="card"><h2>Note importanti</h2><ul class="nlist">`;
  for (const k in labels) if (n[k]) h += `<li><div class="t">${labels[k]}</div><div class="d">${ESC(n[k])}</div></li>`;
  h += `</ul></div>`;
  h += `<div class="card"><h2>Integrazione consigliata</h2>`;
  for (const it of DATA.integrazione.integratori) h += `<div class="intg"><span class="n">${ESC(it.nome)}</span><span class="dose">${ESC(it.dosaggio)}</span></div>`;
  h += `</div>`;
  const en = DATA.allenamento.noteEsecutive;
  h += `<div class="card"><h2>Note esecutive</h2><ul class="nlist">`;
  h += `<li><div class="t">Serie di avvicinamento</div><div class="d">${ESC(en.serieDiAvvicinamento)}</div></li>`;
  h += `<li><div class="t">Carico interno</div><div class="d">${ESC(en.caricoInterno)}</div></li>`;
  h += `<li><div class="t">Recupero</div><div class="d">${ESC(en.recupero)}</div></li>`;
  h += `</ul></div>`;
  view().innerHTML = h;
}

// ---- ZOOM immagine (lightbox) ----
function setupLightbox() {
  const lb = document.createElement('div');
  lb.id = 'lightbox'; lb.hidden = true;
  lb.innerHTML = '<img alt="Esercizio" /><button type="button" class="lb-close" aria-label="Chiudi">&times;</button>';
  document.body.appendChild(lb);
  const hide = () => { lb.hidden = true; };
  lb.addEventListener('click', hide);
  document.addEventListener('click', e => {
    const img = e.target.closest('.ex-img img');
    if (img && img.getAttribute('src')) { lb.querySelector('img').src = img.src; lb.hidden = false; }
  });
}

// ---- SIRI ----
const SIRI_BASE = 'https://cinzia90.github.io/fuel/data/siri/';
const SC_BASE = 'https://cinzia90.github.io/fuel/shortcuts/';
function renderSiri() {
  const dateItems = [
    ['Cosa alleno oggi', 'allenamento/'],
    ['Cosa mangio a colazione', 'colazione/'],
    ['Cosa mangio a pranzo', 'pranzo/'],
    ['Cosa mangio per lo spuntino', 'spuntino/'],
    ['Cosa mangio per cena', 'cena/'],
  ];
  const dl = [
    ['Cosa alleno oggi', 'Cosa-alleno-oggi'],
    ['Cosa mangio a colazione', 'Cosa-mangio-a-colazione'],
    ['Cosa mangio a pranzo', 'Cosa-mangio-a-pranzo'],
    ['Cosa mangio per lo spuntino', 'Cosa-mangio-per-lo-spuntino'],
    ['Cosa mangio per cena', 'Cosa-mangio-per-cena'],
    ['Qual e l’integrazione', 'Qual-e-l-integrazione'],
  ];
  let h = `<h1 class="page">Siri</h1><p class="sub">Poi chiedi a Siri, anche dall’Apple Watch.</p>`;
  // VIA RAPIDA (scarica)
  h += `<div class="card"><h2>Via rapida: scarica i comandi</h2>
    <p class="meta" style="margin-bottom:10px">Serve attivare <b>una volta</b> un’impostazione:</p>
    <ul class="nlist">
      <li><div class="t">1. Apri <b>Comandi rapidi</b> → Galleria → aggiungi un comando qualsiasi e <b>toccalo</b> una volta (serve a sbloccare l’impostazione)</div></li>
      <li><div class="t">2. Impostazioni → <b>Comandi rapidi</b> → attiva <b>Consenti comandi non attendibili</b></div></li>
      <li><div class="t">3. Torna qui e tocca <b>Scarica</b>: si apre in Comandi rapidi → <b>Aggiungi comando non attendibile</b></div></li>
    </ul>
    <div class="siri-dl">`;
  for (const [name, file] of dl) {
    h += `<a class="dl-btn" href="${SC_BASE}${file}.shortcut"><span class="plus">↓</span><span class="lbl">${ESC(name)}</span></a>`;
  }
  h += `</div><p class="eaa" style="margin-top:10px">Se dà “formato non valido”, usa la via manuale qui sotto.</p></div>`;
  // VIA MANUALE
  h += `<div class="card"><h2>Via manuale (funziona sempre)</h2><ul class="nlist">
    <li><div class="t">1. Comandi rapidi → <b>+</b> → Aggiungi azione</div></li>
    <li><div class="t">2. Aggiungi <b>Data</b></div><div class="d">(cerca “Data”, lascia “Data corrente”)</div></li>
    <li><div class="t">3. Aggiungi <b>Formatta data</b></div><div class="d">Formato → <b>Personalizzato</b> → scrivi <b>yyyy-MM-dd</b></div></li>
    <li><div class="t">4. Aggiungi <b>Testo</b></div><div class="d">Incolla il link copiato qui sotto, poi tocca e inserisci la variabile <b>Data formattata</b>, infine scrivi <b>.txt</b></div></li>
    <li><div class="t">5. Aggiungi <b>Ottieni contenuti di URL</b></div></li>
    <li><div class="t">6. Aggiungi <b>Pronuncia testo</b></div></li>
    <li><div class="t">7. Rinomina col nome della domanda → Fine</div></li>
  </ul></div>`;
  h += `<h2 class="cs-day-title" style="font-size:15px;color:var(--mute);margin:4px 2px 8px">Domande con la data (link da copiare)</h2>`;
  for (const [name, sub] of dateItems) {
    h += siriRow(name, SIRI_BASE + sub, true);
  }
  h += `<h2 class="cs-day-title" style="font-size:15px;color:var(--mute);margin:16px 2px 8px">Integrazione (senza data: salta i passi 2-3-4, usa solo Testo col link intero)</h2>`;
  h += siriRow('Qual e l’integrazione', SIRI_BASE + 'integrazione.txt', false);
  view().innerHTML = h;
  view().querySelectorAll('.copy-url').forEach(btn => btn.onclick = async () => {
    try { await navigator.clipboard.writeText(btn.dataset.url); btn.textContent = 'Copiato ✓'; setTimeout(() => btn.textContent = 'Copia', 1400); }
    catch { btn.textContent = 'Seleziona e copia'; }
  });
}
function siriRow(name, url, dated) {
  return `<div class="card" style="padding:12px 14px">
    <div style="font-weight:800;margin-bottom:6px">${ESC(name)}</div>
    <div class="siri-url">${ESC(url)}${dated ? '<span class="ph-date">[Data]</span>.txt' : ''}</div>
    <button class="copy-url" data-url="${ESC(url)}">Copia</button>
  </div>`;
}

// ---- NAV ----
const TABS = { oggi: renderOggi, allenamento: renderAllenamento, note: renderNote, siri: renderSiri };
function go(tab) {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.tab === tab ? 'true' : 'false'));
  (TABS[tab] || renderOggi)();
  try { localStorage.setItem('fuel.tab', tab); } catch {}
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => go(t.dataset.tab));

(async function init() {
  Store.load();
  try { await loadData(); } catch { view().innerHTML = '<div class="loading">Errore nel caricamento dei dati.</div>'; return; }
  setBadge();
  await Store.syncFromCloud();
  let tab = 'oggi'; try { tab = localStorage.getItem('fuel.tab') || 'oggi'; } catch {}
  go(tab);
  setupLightbox();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
