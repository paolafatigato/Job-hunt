/* ═══════════════════════════════════════════
   CACCIA AL LAVORO — logica dell'app
   Autenticazione Google + Firebase Realtime
   Database: ogni utente vede solo i suoi dati,
   sincronizzati automaticamente tra dispositivi.
   ═══════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyDlKhAp5QDXlu79C8i5X-dZ27Fyvzu1HVs",
  authDomain: "jobhunt-5eadd.firebaseapp.com",
  projectId: "jobhunt-5eadd",
  storageBucket: "jobhunt-5eadd.firebasestorage.app",
  messagingSenderId: "667855566762",
  appId: "1:667855566762:web:20988f5e81f2b4b6fa1dd3"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const googleProvider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;
let jobsRef = null;
let jobs = [];

function loginGoogle() {
  const status = document.getElementById('login-status');
  status.textContent = 'Accesso in corso…';
  auth.signInWithPopup(googleProvider).catch(err => {
    status.textContent = '⚠️ ' + err.message;
  });
}

function logout() {
  if (jobsRef) { jobsRef.off(); jobsRef = null; }
  auth.signOut();
}

function subscribeJobs(uid) {
  jobsRef = db.ref('users/' + uid + '/jobs');
  jobsRef.on('value', snap => {
    const val = snap.val() || {};
    jobs = Object.keys(val).map(k => ({ id: k, ...val[k] }));
    render();
  }, err => {
    toast('⚠️ Errore di sincronizzazione: ' + err.message, 4000);
  });
}

auth.onAuthStateChanged(user => {
  const loginScreen = document.getElementById('login-screen');
  const appContent = document.getElementById('app-content');
  const userBadge = document.getElementById('user-badge');
  if (user) {
    currentUser = user;
    loginScreen.style.display = 'none';
    appContent.style.display = 'block';
    userBadge.style.display = 'flex';
    document.getElementById('user-avatar').src = user.photoURL || '';
    document.getElementById('user-name').textContent = user.displayName || user.email || '';
    subscribeJobs(user.uid);
  } else {
    currentUser = null;
    if (jobsRef) { jobsRef.off(); jobsRef = null; }
    jobs = [];
    loginScreen.style.display = 'flex';
    appContent.style.display = 'none';
    userBadge.style.display = 'none';
  }
});

let currentSort = 'data';
let editingId = null;
let deletingId = null;
let currentStars = 0;
let toggleState = { macchina: false, contattata: false };

const STATO_ORDER = ['da-candidarsi','candidato','colloquio-fissato','colloquio-fatto','offerta','rifiutato','ritirata'];
const STATO_LABEL = {
  'da-candidarsi':    '🆕 Da candidarsi',
  'candidato':        '📨 Candidatura inviata',
  'colloquio-fissato':'📅 Colloquio fissato',
  'colloquio-fatto':  '✅ Colloquio fatto',
  'offerta':          '🎉 Offerta ricevuta',
  'rifiutato':        '❌ Rifiutata',
  'ritirata':         '🚫 Ritirata'
};
const STATO_RANK = Object.fromEntries(STATO_ORDER.map((s,i)=>[s,i]));

function toast(msg, ms=2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), ms);
}

/* ─── formattazione ─── */
function fmtMoney(n) {
  if(!n) return '—';
  return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
}
function fmtDate(dt) {
  if(!dt) return '';
  try {
    const d = new Date(dt);
    if(isNaN(d.getTime())) return dt;
    return d.toLocaleString('it-IT', { weekday:'short', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
  } catch(e) { return dt; }
}
function starsHTML(n) {
  return Array.from({length:10},(_,i)=>`<span class="star ${i<n?'filled':''}">★</span>`).join('');
}

/* ─── card ─── */
function renderCard(j, idx) {
  const hasLink = j.link && j.link.startsWith('http');
  const isChiusa = j.stato==='rifiutato' || j.stato==='ritirata';
  const isOfferta = j.stato==='offerta';

  const tags = [];
  if(j.modalita) tags.push(`<span class="tag">${j.modalita==='In sede'?'🏢':j.modalita==='Remoto'?'🏠':'🔀'} ${j.modalita}</span>`);
  if(j.contratto) tags.push(`<span class="tag">📄 ${j.contratto}</span>`);
  if(j.macchina===true) tags.push(`<span class="tag macchina-si">🚗 Macchina necessaria</span>`);
  if(j.macchina===false) tags.push(`<span class="tag macchina-no">🚫 Macchina non serve</span>`);

  const dists = [];
  const distCasaParts = [];
  if(j.distCasaKm) distCasaParts.push(`📍${j.distCasaKm}km`);
  if(j.distCasaAuto) distCasaParts.push(`🚗${j.distCasaAuto}′`);
  if(j.distCasaMezzi) distCasaParts.push(`🚌${j.distCasaMezzi}′`);
  if(distCasaParts.length) dists.push(`<span class="dist-item">🏠 <span class="dist-val">${distCasaParts.join(' ')}</span></span>`);
  const distStazParts = [];
  if(j.distStazioneKm) distStazParts.push(`📍${j.distStazioneKm}km`);
  if(j.distStazionePiedi) distStazParts.push(`🚶${j.distStazionePiedi}′`);
  if(distStazParts.length) dists.push(`<span class="dist-item">🚂 <span class="dist-val">${distStazParts.join(' ')}</span></span>`);

  const proHTML = j.pro
    ? j.pro.split('\n').filter(Boolean).map(l=>`• ${l}`).join('<br>')
    : '<span class="pc-empty">nessuna nota</span>';
  const controHTML = j.contro
    ? j.contro.split('\n').filter(Boolean).map(l=>`• ${l}`).join('<br>')
    : '<span class="pc-empty">nessuna nota</span>';

  const stato = j.stato || 'da-candidarsi';

  return `
  <div class="card${isChiusa?' chiusa':''}${isOfferta?' offerta':''}" id="card-${j.id}" onclick="openModal('${j.id}')" style="cursor:pointer;">
    <div class="card-header">
      <div class="card-num">${idx+1}</div>
      <div class="card-title-area">
        <div class="card-ruolo" title="${j.ruolo||''}">${j.ruolo||'Ruolo senza nome'}</div>
        <div class="card-azienda" title="${j.azienda||''}">${j.azienda||'Azienda n.d.'}</div>
        <div class="stars">${starsHTML(j.stelline||0)}</div>
      </div>
      <span class="badge badge-stato-${stato}" onclick="event.stopPropagation(); quickStato('${j.id}')" title="Clicca per far avanzare lo stato">${STATO_LABEL[stato]}</span>
    </div>

    <div class="price-row">
      <span class="stipendio">${fmtMoney(j.stipendio)}</span>
      ${j.stipendio?`<span class="stipendio-tipo">${j.stipendioTipo||''}</span>`:''}
      ${j.sede?`<span class="sede-txt">📍 ${j.sede}</span>`:''}
    </div>

    ${tags.length?`<div class="tags-row">${tags.join('')}</div>`:''}

    <div class="meta-row">
      <span class="dove-txt" title="${j.dove||''}">🔎 ${j.dove||'<span style="color:var(--tl);font-style:italic;">Fonte n.d.</span>'}</span>
      ${j.referente?`<span style="font-size:.74rem;color:var(--tl);">— ${j.referente}</span>`:''}
      <span class="badge badge-con ${j.contattata?'yes':'no'}" onclick="event.stopPropagation(); quickContattata('${j.id}')" style="cursor:pointer;">${j.contattata?'📞 Contattata':'📵 Non contattata'}</span>
    </div>

    ${j.dataColloquio?`<div class="colloquio-row">📅 ${fmtDate(j.dataColloquio)}</div>`:''}

    ${dists.length?`<div class="distances">${dists.join('')}</div>`:''}

    <div class="pro-contro">
      <div>
        <div class="pc-label pro">✅ Pro</div>
        <div class="pc-text">${proHTML}</div>
      </div>
      <div>
        <div class="pc-label contro">❌ Contro</div>
        <div class="pc-text">${controHTML}</div>
      </div>
    </div>

    ${j.note?`<div class="note-txt">📝 ${j.note}</div>`:''}

    <div class="card-actions">
      ${hasLink?`<a class="btn btn-ghost btn-sm" href="${j.link}" target="_blank" onclick="event.stopPropagation()">🔗 Annuncio</a>`:''}
      <button class="btn btn-ghost btn-sm" title="Apri in Maps" onclick="event.stopPropagation(); window.open('https://maps.google.com/?q=${encodeURIComponent(j.sede||j.azienda||'')}', '_blank')">🗺️ Maps</button>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteJob('${j.id}')">🗑️</button>
    </div>
  </div>`;
}

/* ─── ordinamento ─── */
function getSorted() {
  const arr = [...jobs];
  let sorted;
  switch(currentSort) {
    case 'stipendio':     sorted = arr.sort((a,b)=>(b.stipendio||0)-(a.stipendio||0)); break;
    case 'stelline':      sorted = arr.sort((a,b)=>(b.stelline||0)-(a.stelline||0)); break;
    case 'distCasa':      sorted = arr.sort((a,b)=>(a.distCasaKm??9999)-(b.distCasaKm??9999)); break;
    case 'distStazione':  sorted = arr.sort((a,b)=>(a.distStazioneKm??9999)-(b.distStazioneKm??9999)); break;
    case 'stato':         sorted = arr.sort((a,b)=>(STATO_RANK[a.stato]??0)-(STATO_RANK[b.stato]??0)); break;
    default:               sorted = arr.sort((a,b)=>Number(b.id||0)-Number(a.id||0));
  }
  // rifiutate/ritirate sempre in fondo
  return sorted.sort((a,b)=>{
    const ac = (a.stato==='rifiutato'||a.stato==='ritirata')?1:0;
    const bc = (b.stato==='rifiutato'||b.stato==='ritirata')?1:0;
    return ac-bc;
  });
}

function renderStats() {
  const bar = document.getElementById('stats-bar');
  if(jobs.length === 0){ bar.style.display='none'; return; }
  bar.style.display='flex';
  const stipendi = jobs.filter(j=>j.stipendio>0).map(j=>j.stipendio);
  const contattate = jobs.filter(j=>j.contattata).length;
  const colloqui = jobs.filter(j=>j.stato==='colloquio-fissato'||j.stato==='colloquio-fatto').length;
  const offerte = jobs.filter(j=>j.stato==='offerta').length;
  const stelleTot = jobs.filter(j=>j.stelline>0);
  const avgStelle = stelleTot.length ? (stelleTot.reduce((s,j)=>s+j.stelline,0)/stelleTot.length).toFixed(1)+'/10' : '—';
  const minS = stipendi.length ? fmtMoney(Math.min(...stipendi)) : '—';
  const maxS = stipendi.length ? fmtMoney(Math.max(...stipendi)) : '—';
  bar.innerHTML = `
    <span class="stat">Stipendi: <strong>${minS} — ${maxS}</strong></span>
    <span class="stat">Contattate: <strong>${contattate} / ${jobs.length}</strong></span>
    <span class="stat">Colloqui: <strong>${colloqui}</strong></span>
    <span class="stat">Offerte: <strong>${offerte}</strong></span>
    <span class="stat">Gradimento medio: <strong>${avgStelle}${avgStelle!=='—'?' ⭐':''}</strong></span>`;
}

function render() {
  const grid = document.getElementById('grid');
  const sorted = getSorted();
  const pl = sorted.length===1?'candidatura':'candidature';
  document.getElementById('count-badge').textContent = `${sorted.length} ${pl}`;
  renderStats();
  if(sorted.length===0){
    grid.innerHTML=`<div class="empty-state">
      <div class="empty-icon">💼</div>
      <h3>Nessuna candidatura ancora</h3>
      <p>Inizia aggiungendo le posizioni che ti interessano — tutto salvato sul tuo browser!</p>
      <button class="btn btn-primary" onclick="openModal()">+ Aggiungi la prima candidatura</button>
    </div>`;
    return;
  }
  grid.innerHTML = sorted.map((j,i)=>renderCard(j,i)).join('') + `
    <div class="card" id="card-add" onclick="event.stopPropagation(); openModal();" style="display:flex;align-items:center;justify-content:center;cursor:default;">
      <div style="padding:1rem;text-align:center;">
        <button class="btn btn-primary" onclick="event.stopPropagation(); openModal()">+ Aggiungi candidatura</button>
      </div>
    </div>`;
}

function setSort(s) {
  currentSort = s;
  document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
  const el = document.getElementById('pill-'+s);
  if(el) el.classList.add('active');
  render();
}

/* ─── azioni rapide dalla card ─── */
function quickStato(id) {
  if(!currentUser) return;
  const j = jobs.find(x=>x.id===id);
  if(!j) return;
  const cur = STATO_ORDER.indexOf(j.stato||'da-candidarsi');
  const next = STATO_ORDER[(cur+1) % STATO_ORDER.length];
  db.ref(`users/${currentUser.uid}/jobs/${id}/stato`).set(next)
    .then(()=> toast(`Stato aggiornato: ${STATO_LABEL[next]}`))
    .catch(err=> toast('⚠️ ' + err.message));
}
function quickContattata(id) {
  if(!currentUser) return;
  const j = jobs.find(x=>x.id===id);
  if(!j) return;
  const nuovo = !j.contattata;
  db.ref(`users/${currentUser.uid}/jobs/${id}/contattata`).set(nuovo)
    .then(()=> toast(nuovo ? '📞 Segnata come contattata' : '📵 Segnata come non contattata'))
    .catch(err=> toast('⚠️ ' + err.message));
}

/* ─── modale ─── */
function openModal(id=null) {
  editingId = id;
  resetForm();
  document.getElementById('modal-title').textContent = id ? 'Modifica candidatura' : 'Aggiungi candidatura';
  if(id) {
    const j = jobs.find(x=>x.id===id);
    if(!j) return;
    const map = {
      'ruolo':j.ruolo,'azienda':j.azienda,'link':j.link,'sede':j.sede,
      'stipendio':j.stipendio||'','referente':j.referente,
      'casa-km':j.distCasaKm||'','casa-auto':j.distCasaAuto||'','casa-mezzi':j.distCasaMezzi||'',
      'staz-km':j.distStazioneKm||'','staz-piedi':j.distStazionePiedi||'',
      'pro':j.pro,'contro':j.contro,'note':j.note,'data-colloquio':j.dataColloquio||''
    };
    Object.keys(map).forEach(f=>{ const el=document.getElementById('f-'+f); if(el) el.value=map[f]||''; });
    setSelect('f-dove', j.dove);
    setSelect('f-modalita', j.modalita);
    setSelect('f-contratto', j.contratto);
    setSelect('f-stipendio-tipo', j.stipendioTipo || 'Netto mensile');
    setSelect('f-stato', j.stato || 'da-candidarsi');
    setStar(j.stelline||0);
    setToggle('macchina', j.macchina===true, true);
    setToggle('contattata', !!j.contattata, true);
  }
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}
function setSelect(id, val) {
  const el = document.getElementById(id);
  if(el) el.value = val || el.options[0].value;
}

function resetForm() {
  const fields=['ruolo','azienda','link','sede','stipendio','referente','casa-km','casa-auto','casa-mezzi','staz-km','staz-piedi','pro','contro','note','data-colloquio'];
  fields.forEach(f=>{ const el=document.getElementById('f-'+f); if(el) el.value=''; });
  setSelect('f-dove','');
  setSelect('f-modalita','');
  setSelect('f-contratto','');
  setSelect('f-stipendio-tipo','Netto mensile');
  setSelect('f-stato','da-candidarsi');
  currentStars=0; updateStarDisplay();
  toggleState={macchina:false,contattata:false};
  updateToggleDisplay('macchina'); updateToggleDisplay('contattata');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow='';
  editingId=null;
}
function closeOnOverlay(e){ if(e.target.id==='modal-overlay') closeModal(); }

/* ─── stelle ─── */
function setStar(n){ currentStars=n; updateStarDisplay(); }
function updateStarDisplay(){
  document.querySelectorAll('.star-btn').forEach(b=>{
    b.classList.toggle('on', parseInt(b.dataset.v)<=currentStars);
  });
}

/* ─── toggle sì/no ─── */
function setToggle(field,val){
  toggleState[field]=val;
  updateToggleDisplay(field);
}
function updateToggleDisplay(field){
  const val=toggleState[field];
  if(field==='macchina'){
    document.getElementById('tb-macc-si').className='tgl '+(val?'sel-yes':'sel-no');
    document.getElementById('tb-macc-no').className='tgl '+(!val?'sel-yes':'sel-no');
  } else {
    document.getElementById('tb-con-si').className='tgl '+(val?'sel-yes':'sel-no');
    document.getElementById('tb-con-no').className='tgl '+(!val?'sel-yes':'sel-no');
  }
}

/* ─── salvataggio ─── */
function saveJob() {
  if(!currentUser) { toast('⚠️ Devi accedere per salvare'); return; }
  const ruolo = document.getElementById('f-ruolo').value.trim();
  const azienda = document.getElementById('f-azienda').value.trim();
  if(!ruolo || !azienda) {
    toast('⚠️ Inserisci almeno ruolo e azienda');
    return;
  }
  const num = id => { const v = document.getElementById(id).value; return v===''? null : Number(v); };
  const txt = id => document.getElementById(id).value.trim();

  const data = {
    ruolo, azienda,
    link: txt('f-link'),
    sede: txt('f-sede'),
    dove: document.getElementById('f-dove').value,
    modalita: document.getElementById('f-modalita').value,
    contratto: document.getElementById('f-contratto').value,
    stipendio: num('f-stipendio'),
    stipendioTipo: document.getElementById('f-stipendio-tipo').value,
    distCasaKm: num('f-casa-km'),
    distCasaAuto: num('f-casa-auto'),
    distCasaMezzi: num('f-casa-mezzi'),
    distStazioneKm: num('f-staz-km'),
    distStazionePiedi: num('f-staz-piedi'),
    macchina: toggleState.macchina,
    contattata: toggleState.contattata,
    referente: txt('f-referente'),
    stato: document.getElementById('f-stato').value,
    dataColloquio: document.getElementById('f-data-colloquio').value,
    stelline: currentStars,
    pro: txt('f-pro'),
    contro: txt('f-contro'),
    note: txt('f-note')
  };

  const id = editingId || db.ref(`users/${currentUser.uid}/jobs`).push().key;
  db.ref(`users/${currentUser.uid}/jobs/${id}`).set(data)
    .then(()=>{
      closeModal();
      toast(editingId ? '✏️ Candidatura aggiornata' : '✅ Candidatura aggiunta');
    })
    .catch(err => toast('⚠️ Errore: ' + err.message, 4000));
}

/* ─── eliminazione ─── */
function deleteJob(id) {
  deletingId = id;
  document.getElementById('confirm-dialog').classList.add('open');
}
function cancelDelete() {
  deletingId = null;
  document.getElementById('confirm-dialog').classList.remove('open');
}
function confirmDelete() {
  if(deletingId && currentUser) {
    db.ref(`users/${currentUser.uid}/jobs/${deletingId}`).remove()
      .then(()=> toast('🗑️ Candidatura eliminata'))
      .catch(err=> toast('⚠️ Errore: ' + err.message, 4000));
  }
  cancelDelete();
}

/* ─── export ─── */
function exportData() {
  const blob = new Blob([JSON.stringify(jobs, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'caccia-al-lavoro-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('💾 Dati esportati');
}

/* ─── init ───
   Il rendering parte automaticamente da
   auth.onAuthStateChanged() qui sopra, quando
   lo stato di login viene determinato. */