'use strict';

(() => {
  const APP_VERSION = '2.5.0';
  const SCHEMA_VERSION = 4;
  const STORAGE_KEY = 'persFavouritesStateV25';
  const LEGACY_KEYS = ['persFavouritesStateV24', 'persFavouritesStateV23', 'persFavouritesState'];
  const MAX_HISTORY = 12;
  const app = document.getElementById('app');

  let state = loadState();
  let ui = { tab: 'places', search: '', listFilter: 'active', sort: 'name', currentLocation: null, map: null, markers: null, importPreview: [], importFiles: [] };

  function blankState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      mode: null,
      profile: { displayName: 'Per' },
      places: [],
      history: [],
      settings: { textSize: 'normal' },
      updatedAt: nowISO()
    };
  }

  function loadState() {
    const candidates = [STORAGE_KEY, ...LEGACY_KEYS];
    for (const key of candidates) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const migrated = migrateState(parsed);
        if (migrated) {
          // When upgrading from an earlier local-store key, write v2.4 first and
          // remove the legacy copy only after that write succeeds. If the new
          // write is temporarily blocked by storage quota, still open the valid
          // old data rather than presenting an empty catalogue.
          if (key !== STORAGE_KEY) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
              LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
            } catch (writeError) {
              console.warn('Loaded legacy data but could not persist the migrated v2.4 copy yet', writeError);
            }
          }
          return migrated;
        }
      } catch (e) { console.warn('Could not load state', e); }
    }
    return blankState();
  }

  function migrateState(s) {
    if (!s || typeof s !== 'object') return null;
    const out = blankState();
    out.mode = s.mode || 'local';
    out.profile = { ...out.profile, ...(s.profile || {}) };
    out.settings = { ...out.settings, ...(s.settings || {}) };
    out.places = Array.isArray(s.places) ? s.places.map(normalizePlace).filter(Boolean) : [];
    out.history = Array.isArray(s.history) ? s.history.slice(0, MAX_HISTORY).map(v => ({
      id: String(v.id || uid()),
      createdAt: v.createdAt || nowISO(),
      label: String(v.label || 'Saved version'),
      reason: String(v.reason || ''),
      snapshot: sanitizeSnapshot(v.snapshot || {})
    })) : [];
    out.updatedAt = s.updatedAt || nowISO();
    return out;
  }

  function normalizePlace(p) {
    if (!p || typeof p !== 'object') return null;
    const personal = p.personal || {};
    const archivedAt = p.archivedAt || (p.status === 'Archived' ? (p.updatedAt || nowISO()) : null);
    return {
      id: String(p.id || uid()),
      name: String(p.name || p.title || '').trim(),
      category: String(p.category || p.cuisine || '').trim(),
      city: String(p.city || '').trim(),
      country: String(p.country || '').trim(),
      address: String(p.address || '').trim(),
      notes: String(p.notes || p.perNotes || '').trim(),
      tags: Array.isArray(p.tags) ? p.tags.map(String) : splitTags(p.tags || ''),
      sourceUrl: String(p.sourceUrl || p.googleMapsUrl || p.url || '').trim(),
      website: String(p.website || '').trim(),
      phone: String(p.phone || '').trim(),
      lat: parseCoordinate(p.lat ?? p.latitude, -90, 90),
      lng: parseCoordinate(p.lng ?? p.long ?? p.longitude, -180, 180),
      createdAt: p.createdAt || nowISO(),
      updatedAt: p.updatedAt || nowISO(),
      archivedAt,
      personal: {
        saved: Boolean(personal.saved ?? p.saved),
        wantToGo: Boolean(personal.wantToGo ?? p.wantToGo),
        rating: clampRating(personal.rating ?? p.rating),
        privateNote: String(personal.privateNote || p.privateNote || ''),
        visits: Array.isArray(personal.visits || p.visits) ? (personal.visits || p.visits).map(v => ({
          id: String(v.id || uid()), date: String(v.date || '').slice(0,10), rating: clampRating(v.rating), comment: String(v.comment || '')
        })) : []
      }
    };
  }

  function saveState() {
    state.schemaVersion = SCHEMA_VERSION;
    state.appVersion = APP_VERSION;
    state.updatedAt = nowISO();

    // Version checkpoints are useful, but browser storage is finite. If storage
    // is tight, preserve the current catalogue first and progressively trim only
    // the oldest history snapshots rather than allowing an edit to fail outright.
    let lastError = null;
    for (;;) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return;
      } catch (err) {
        lastError = err;
        if (!Array.isArray(state.history) || state.history.length <= 3) break;
        state.history.pop();
      }
    }
    console.error('Could not save local trial data', lastError);
    throw lastError || new Error('Could not save local trial data. Export a backup and free browser storage.');
  }

  function nowISO(){ return new Date().toISOString(); }
  function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function splitTags(v){ return String(v || '').split(/[;,]/).map(x => x.trim()).filter(Boolean); }
  function clampRating(v){ const n = Number(v); return Number.isFinite(n) && n >= 1 ? Math.min(5, Math.max(1, Math.round(n))) : 0; }
  function parseCoordinate(value, min, max) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (text === '') return null; // v2.4 fix: blank coordinates are NOT zero.
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  }
  function hasCoords(p){ return Number.isFinite(p.lat) && Number.isFinite(p.lng); }
  function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso); return Number.isNaN(d.getTime())?'':d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); }
  function stars(n){ return n ? '★'.repeat(n) + '☆'.repeat(5-n) : 'Not rated'; }

  function createCheckpoint(label, reason = '') {
    const snapshot = sanitizeSnapshot({ profile: state.profile, places: state.places, settings: state.settings });
    state.history.unshift({ id: uid(), createdAt: nowISO(), label, reason, snapshot });
    state.history = state.history.slice(0, MAX_HISTORY);
    saveState();
  }

  function sanitizeSnapshot(s) {
    return {
      profile: JSON.parse(JSON.stringify(s.profile || { displayName: 'Per' })),
      places: Array.isArray(s.places) ? s.places.map(normalizePlace).filter(Boolean) : [],
      settings: JSON.parse(JSON.stringify(s.settings || {}))
    };
  }

  function backupObject(snapshot = null, label = 'Current device backup') {
    const snap = snapshot ? sanitizeSnapshot(snapshot) : sanitizeSnapshot(state);
    return {
      type: 'pers-favourites-device-backup',
      backupFormatVersion: 2,
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      createdAt: nowISO(),
      label,
      data: snap,
      versions: snapshot ? [] : state.history.map(v => ({ id:v.id, createdAt:v.createdAt, label:v.label, reason:v.reason, snapshot:sanitizeSnapshot(v.snapshot) }))
    };
  }

  async function exportJson(obj, filename) {
    const text = JSON.stringify(obj, null, 2);
    const file = new File([text], filename, {type:'application/json'});
    if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
      try { await navigator.share({files:[file], title:"Per's Favourites backup"}); return; } catch(e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function render() {
    if (!state.mode) return renderWelcome();
    document.documentElement.style.fontSize = state.settings.textSize === 'large' ? '18px' : '16px';
    app.innerHTML = `<div class="shell"><div class="topbar"><div><div class="brand">PER'S FAVOURITES</div><div class="version">Final Trial PWA v${APP_VERSION} · Local Test</div></div><button class="btn small" data-action="quick-backup">Backup</button></div><main id="main"></main></div>${bottomNav()}`;
    const main = document.getElementById('main');
    if (ui.tab === 'places') renderPlaces(main);
    else if (ui.tab === 'map') renderMap(main);
    else if (ui.tab === 'import') renderImport(main);
    else renderSettings(main);
    bindCommon();
  }

  function renderWelcome(){
    app.innerHTML = `<div class="hero"><div class="card"><h1>Per's Favourites</h1><div class="version">Final Trial PWA v${APP_VERSION}</div><p>This trial stores the catalogue, your ratings, visits and notes on this device. It does not automatically sync to iCloud or Google Drive.</p><div class="notice"><strong>Before an app update or phone change:</strong> export a device backup from Settings and save it in Files, iCloud Drive or Google Drive.</div><p><button id="startLocal" class="btn primary" style="width:100%;margin-top:12px">Start local test on this device</button></p><p class="smalltext muted">No account or server login is required for this first trial.</p></div></div>`;
    document.getElementById('startLocal').onclick = () => { state.mode='local'; saveState(); render(); };
  }

  function bottomNav(){
    const items=[['places','Places'],['map','Map'],['import','Import'],['settings','Settings']];
    return `<nav class="bottomnav"><div class="bottomnav-inner">${items.map(([id,label])=>`<button class="navbtn ${ui.tab===id?'active':''}" data-tab="${id}">${label}</button>`).join('')}</div></nav>`;
  }

  function bindCommon(){
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick=()=>{ui.tab=b.dataset.tab; render();});
    const qb=document.querySelector('[data-action="quick-backup"]'); if(qb) qb.onclick=()=>exportCurrentBackup();
  }


  function archivePlaceById(id) {
    const p = state.places.find(x => x.id === id);
    if (!p || p.archivedAt) return false;
    createCheckpoint('Before archive', `Archived ${p.name}`);
    p.archivedAt = nowISO(); p.updatedAt = nowISO(); saveState();
    return true;
  }

  function restoreArchivedPlaceById(id) {
    const p = state.places.find(x => x.id === id);
    if (!p || !p.archivedAt) return false;
    createCheckpoint('Before archive restore', `Restored ${p.name}`);
    p.archivedAt = null; p.updatedAt = nowISO(); saveState();
    return true;
  }

  function permanentDeleteArchivedPlaceById(id) {
    const p = state.places.find(x => x.id === id);
    if (!p || !p.archivedAt) return false; // hard guard: active records cannot be permanently deleted.
    createCheckpoint('Before permanent deletion', `Deleted ${p.name}`);
    state.places = state.places.filter(x => x.id !== id); saveState();
    return true;
  }

  function activePlaces(){ return state.places.filter(p=>!p.archivedAt); }
  function archivedPlaces(){ return state.places.filter(p=>p.archivedAt); }

  function renderPlaces(main){
    const all = ui.listFilter === 'archive' ? archivedPlaces() : activePlaces();
    let rows = all.filter(p => {
      const hay=[p.name,p.category,p.city,p.country,p.address,p.notes,p.tags.join(' '),p.personal.privateNote].join(' ').toLowerCase();
      return hay.includes(ui.search.toLowerCase());
    });
    if(ui.listFilter==='saved') rows=rows.filter(p=>p.personal.saved);
    if(ui.listFilter==='want') rows=rows.filter(p=>p.personal.wantToGo);
    if(ui.listFilter==='visited') rows=rows.filter(p=>p.personal.visits.length);
    if(ui.sort==='rating') rows.sort((a,b)=>b.personal.rating-a.personal.rating || a.name.localeCompare(b.name));
    else if(ui.sort==='recent') rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    else if(ui.sort==='nearest' && ui.currentLocation) rows.sort((a,b)=>distanceKm(ui.currentLocation,a)-distanceKm(ui.currentLocation,b));
    else rows.sort((a,b)=>a.name.localeCompare(b.name));

    main.innerHTML = `<div class="row space"><h2>${ui.listFilter==='archive'?'Archive':'Places'}</h2><button class="btn primary" data-action="add-place">+ Add place</button></div>
      <div class="toolbar"><input id="search" class="search" type="search" placeholder="Search name, cuisine, city, notes..." value="${esc(ui.search)}"><select id="listFilter"><option value="active">All active</option><option value="saved">My saved</option><option value="want">Want to go</option><option value="visited">Visited by me</option><option value="archive">Archive</option></select><select id="sort"><option value="name">Name</option><option value="rating">My rating</option><option value="recent">Recently updated</option><option value="nearest">Nearest</option></select><button class="btn" data-action="locate">My location</button></div>
      <div class="card"><div class="row space"><span><span class="count">${rows.length}</span> shown</span><span class="smalltext muted">${activePlaces().length} active · ${archivedPlaces().length} archived</span></div><div id="placesList">${rows.length?rows.map(placeRow).join(''):'<div class="empty">No places match this view.</div>'}</div></div>`;
    document.getElementById('listFilter').value=ui.listFilter; document.getElementById('sort').value=ui.sort;
    document.getElementById('search').oninput=e=>{ui.search=e.target.value; renderPlaces(main); bindPlaceEvents(main);};
    document.getElementById('listFilter').onchange=e=>{ui.listFilter=e.target.value; renderPlaces(main); bindPlaceEvents(main);};
    document.getElementById('sort').onchange=e=>{ui.sort=e.target.value; renderPlaces(main); bindPlaceEvents(main);};
    bindPlaceEvents(main);
  }

  function bindPlaceEvents(main){
    main.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>openPlace(b.dataset.place));
    const add=main.querySelector('[data-action="add-place"]'); if(add) add.onclick=()=>openEdit(null);
    const loc=main.querySelector('[data-action="locate"]'); if(loc) loc.onclick=getLocation;
  }

  function placeRow(p){
    const d=ui.currentLocation&&hasCoords(p)?`${distanceKm(ui.currentLocation,p).toFixed(1)} km · `:'';
    const flags=[p.personal.saved?'Saved':'',p.personal.wantToGo?'Want to go':'',p.personal.visits.length?'Visited':'',p.archivedAt?'Archived':''].filter(Boolean);
    return `<button class="place-row" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;text-align:left" data-place="${esc(p.id)}"><div><div class="place-name">${esc(p.name||'Untitled place')}</div><div class="meta">${d}${esc([p.category,p.city,p.country].filter(Boolean).join(' · '))}</div><div>${flags.map(f=>`<span class="pill ${f==='Archived'?'archived':''}">${esc(f)}</span>`).join('')}</div></div><div class="right"><div class="stars">${p.personal.rating?esc('★'.repeat(p.personal.rating)):''}</div><span aria-hidden="true">›</span></div></button>`;
  }

  function openPlace(id){
    const p=state.places.find(x=>x.id===id); if(!p)return;
    const visits=p.personal.visits.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    showModal(`<div class="row space"><h2 style="margin:0">${esc(p.name||'Place')}</h2><button class="btn small" data-close>Close</button></div>
      ${p.archivedAt?'<div class="notice warning"><strong>Archived.</strong> This place is hidden from the normal Places and Map views. Permanent deletion is available only here in Archive.</div>':''}
      <p class="muted">${esc([p.category,p.address,p.city,p.country].filter(Boolean).join(' · '))}</p>
      <div class="row"><span class="pill">${esc(stars(p.personal.rating))}</span>${p.personal.saved?'<span class="pill">Saved</span>':''}${p.personal.wantToGo?'<span class="pill">Want to go</span>':''}</div>
      ${p.notes?`<h3>Per/list notes</h3><p>${esc(p.notes)}</p>`:''}${p.personal.privateNote?`<h3>My private note</h3><p>${esc(p.personal.privateNote)}</p>`:''}
      <div class="toolbar"><button class="btn primary" data-edit>Edit</button>${hasCoords(p)?`<a class="btn" href="${appleMapsUrl(p)}" target="_blank" rel="noopener">Apple Maps</a><a class="btn" href="${googleMapsUrl(p)}" target="_blank" rel="noopener">Google Maps</a>`:''}<button class="btn" data-visit>Log visit</button></div>
      <h3>My visits</h3>${visits.length?visits.map(v=>`<div class="visit"><strong>${esc(v.date||'No date')}</strong> · ${esc(stars(v.rating))}<div class="smalltext">${esc(v.comment)}</div></div>`).join(''):'<p class="muted">No visits logged.</p>'}
      <h3>${p.archivedAt?'Archive actions':'Place actions'}</h3><div class="toolbar">${p.archivedAt?'<button class="btn" data-restore-place>Restore to Places</button><button class="btn danger" data-permadelete>Delete permanently</button>':'<button class="btn warn" data-archive>Move to Archive</button>'}</div>`);
    q('[data-edit]').onclick=()=>{closeModal();openEdit(p.id)};
    q('[data-visit]').onclick=()=>openVisit(p.id);
    if(q('[data-archive]')) q('[data-archive]').onclick=()=>{ if(confirm(`Move “${p.name}” to Archive? You can restore it later.`)){archivePlaceById(p.id);closeModal();render();}};
    if(q('[data-restore-place]')) q('[data-restore-place]').onclick=()=>{restoreArchivedPlaceById(p.id);closeModal();render();};
    if(q('[data-permadelete]')) q('[data-permadelete]').onclick=()=>{ if(confirm(`Permanently delete “${p.name}”? This cannot be undone from Archive. A version checkpoint will be kept first.`)){permanentDeleteArchivedPlaceById(p.id);closeModal();render();}};
  }

  function openEdit(id){
    const existing=id?state.places.find(x=>x.id===id):null; const p=existing?JSON.parse(JSON.stringify(existing)):normalizePlace({name:''});
    showModal(`<div class="row space"><h2 style="margin:0">${existing?'Edit place':'Add place'}</h2><button class="btn small" data-close>Close</button></div><form id="editForm">
      <label>Name *</label><input name="name" required value="${esc(p.name)}"><div class="grid2"><div><label>Category / cuisine</label><input name="category" value="${esc(p.category)}"></div><div><label>City</label><input name="city" value="${esc(p.city)}"></div></div>
      <div class="grid2"><div><label>Country</label><input name="country" value="${esc(p.country)}"></div><div><label>Phone</label><input name="phone" value="${esc(p.phone)}"></div></div>
      <label>Address</label><input name="address" value="${esc(p.address)}"><label>Per/list notes</label><textarea name="notes" rows="3">${esc(p.notes)}</textarea><label>Tags (comma separated)</label><input name="tags" value="${esc(p.tags.join(', '))}">
      <label>Original Google Maps / source URL</label><input type="url" name="sourceUrl" value="${esc(p.sourceUrl)}"><label>Website</label><input type="url" name="website" value="${esc(p.website)}">
      <div class="grid2"><div><label>Latitude</label><input name="lat" inputmode="decimal" value="${p.lat??''}"></div><div><label>Longitude</label><input name="lng" inputmode="decimal" value="${p.lng??''}"></div></div>
      <h3>My personal layer</h3><div class="row"><label style="margin:0"><input type="checkbox" name="saved" ${p.personal.saved?'checked':''}> Saved for me</label><label style="margin:0"><input type="checkbox" name="wantToGo" ${p.personal.wantToGo?'checked':''}> Want to go</label></div>
      <label>My private note</label><textarea name="privateNote" rows="3">${esc(p.personal.privateNote)}</textarea><label>My rating</label><div id="ratingStars">${[1,2,3,4,5].map(n=>`<button class="starbtn ${n<=p.personal.rating?'on':''}" type="button" data-rate="${n}">★</button>`).join('')} <button class="btn small" type="button" data-rate="0">Clear</button></div>
      <div class="toolbar"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-close>Cancel</button></div></form>`);
    let rating=p.personal.rating; qAll('[data-rate]').forEach(b=>b.onclick=()=>{rating=Number(b.dataset.rate);qAll('.starbtn').forEach(s=>s.classList.toggle('on',Number(s.dataset.rate)<=rating));});
    q('#editForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const lat=parseCoordinate(f.get('lat'),-90,90),lng=parseCoordinate(f.get('lng'),-180,180);const coords=(lat!==null&&lng!==null)?{lat,lng}:extractCoordsFromText(String(f.get('sourceUrl')||''));
      if(existing) createCheckpoint('Before place edit',`Edited ${existing.name}`);
      Object.assign(p,{name:String(f.get('name')||'').trim(),category:String(f.get('category')||'').trim(),city:String(f.get('city')||'').trim(),country:String(f.get('country')||'').trim(),phone:String(f.get('phone')||'').trim(),address:String(f.get('address')||'').trim(),notes:String(f.get('notes')||'').trim(),tags:splitTags(f.get('tags')),sourceUrl:String(f.get('sourceUrl')||'').trim(),website:String(f.get('website')||'').trim(),lat:coords?.lat??lat,lng:coords?.lng??lng,updatedAt:nowISO()});
      p.personal={...p.personal,saved:f.get('saved')==='on',wantToGo:f.get('wantToGo')==='on',privateNote:String(f.get('privateNote')||''),rating};
      if(existing) state.places[state.places.findIndex(x=>x.id===existing.id)]=normalizePlace(p); else {p.createdAt=nowISO();state.places.push(normalizePlace(p));}
      saveState();closeModal();render();};
  }

  function openVisit(id){ const p=state.places.find(x=>x.id===id);if(!p)return;showModal(`<div class="row space"><h2 style="margin:0">Log visit</h2><button class="btn small" data-close>Close</button></div><form id="visitForm"><label>Date</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"><label>Rating (optional)</label><select name="rating"><option value="0">Not rated</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n} star${n>1?'s':''}</option>`).join('')}</select><label>Private comment</label><textarea name="comment" rows="4"></textarea><div class="toolbar"><button class="btn primary">Save visit</button></div></form>`);q('#visitForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);createCheckpoint('Before visit update',`Visit logged for ${p.name}`);const r=clampRating(f.get('rating'));p.personal.visits.push({id:uid(),date:String(f.get('date')||''),rating:r,comment:String(f.get('comment')||'')});if(r)p.personal.rating=r;p.updatedAt=nowISO();saveState();closeModal();render();}; }

  function renderMap(main){
    const mapped=activePlaces().filter(hasCoords); const missing=activePlaces().length-mapped.length;
    main.innerHTML=`<div class="row space"><h2>Map</h2><span class="smalltext muted">${mapped.length} mapped · ${missing} missing coordinates</span></div><div class="toolbar"><button class="btn primary" data-allpins>Show all pins</button><button class="btn" data-action="locate">My location</button><input id="mapSearch" class="search" placeholder="Filter pins" value="${esc(ui.search)}"></div><div id="map"></div><div class="notice" style="margin-top:10px">The PWA map shows the complete dynamic pin set. Map tiles and external Apple/Google Maps links require an internet connection.</div>`;
    main.querySelector('[data-action="locate"]').onclick=getLocation;
    main.querySelector('[data-allpins]').onclick=()=>{ui.search='';main.querySelector('#mapSearch').value='';drawMap(activePlaces().filter(hasCoords),true);};
    main.querySelector('#mapSearch').oninput=e=>{ui.search=e.target.value;const s=ui.search.toLowerCase();drawMap(mapped.filter(p=>[p.name,p.category,p.city,p.country,p.tags.join(' ')].join(' ').toLowerCase().includes(s)),true);};
    drawMap(ui.search?mapped.filter(p=>[p.name,p.category,p.city,p.country,p.tags.join(' ')].join(' ').toLowerCase().includes(ui.search.toLowerCase())):mapped,true);
  }

  function drawMap(places, fit){
    const el=document.getElementById('map');if(!el)return;
    if(typeof L==='undefined'){el.innerHTML='<div class="empty">Map library could not load. Check the internet connection and reopen the PWA.</div>';return;}
    if(ui.map){ui.map.remove();ui.map=null;}
    ui.map=L.map('map').setView([-25.2744,133.7751],4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(ui.map);
    const bounds=[];
    places.forEach(p=>{const m=L.marker([p.lat,p.lng]).addTo(ui.map);m.bindPopup(`<strong>${esc(p.name)}</strong><br>${esc([p.category,p.city].filter(Boolean).join(' · '))}<br><a href="${googleMapsUrl(p)}" target="_blank" rel="noopener">Google Maps</a> · <a href="${appleMapsUrl(p)}" target="_blank" rel="noopener">Apple Maps</a>`);bounds.push([p.lat,p.lng]);});
    if(ui.currentLocation){L.circleMarker([ui.currentLocation.lat,ui.currentLocation.lng],{radius:7}).addTo(ui.map).bindPopup('My location');bounds.push([ui.currentLocation.lat,ui.currentLocation.lng]);}
    if(fit&&bounds.length===1)ui.map.setView(bounds[0],13);else if(fit&&bounds.length>1)ui.map.fitBounds(bounds,{padding:[24,24]});
  }

  function getLocation(){ if(!navigator.geolocation){alert('Location is not available in this browser.');return;} navigator.geolocation.getCurrentPosition(pos=>{ui.currentLocation={lat:pos.coords.latitude,lng:pos.coords.longitude};render();},err=>alert(`Location was not available: ${err.message}`),{enableHighAccuracy:true,timeout:12000,maximumAge:60000}); }
  function distanceKm(loc,p){if(!loc||!hasCoords(p))return Infinity;const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(p.lat-loc.lat),dLon=toRad(p.lng-loc.lng),a=Math.sin(dLat/2)**2+Math.cos(toRad(loc.lat))*Math.cos(toRad(p.lat))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
  function googleMapsUrl(p){return p.sourceUrl&&/^https?:\/\//i.test(p.sourceUrl)?escAttrUrl(p.sourceUrl):`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.lat},${p.lng}`)}`;}
  function appleMapsUrl(p){return `https://maps.apple.com/?ll=${encodeURIComponent(`${p.lat},${p.lng}`)}&q=${encodeURIComponent(p.name||'Place')}`;}
  function escAttrUrl(url){try{const u=new URL(url);return /^https?:$/.test(u.protocol)?esc(u.href):'#';}catch{return '#';}}

  function renderImport(main){
    main.innerHTML=`<h2>Import Google data</h2><div class="notice"><strong>Use extracted files, not the Takeout ZIP.</strong> Supported files: CSV, JSON and GeoJSON. Google Takeout layouts vary, so always review the preview before importing.</div><div class="card"><h3>1. Select extracted files</h3><div class="filebox"><input id="importFiles" type="file" multiple accept=".csv,.json,.geojson,application/json,text/csv"><p class="smalltext muted">On iPhone: Files opens so you can browse into the unzipped Takeout folder.</p></div><div id="importStatus" class="smalltext muted" style="margin-top:10px"></div><div id="preview" class="preview"></div><div class="toolbar"><button id="importBtn" class="btn primary" disabled>Import selected places</button></div></div><div class="card"><h3>After import</h3><p>Check the Places count, open several entries, then use Map > Show all pins. A place without coordinates is still imported and searchable; it simply cannot be pinned until coordinates are added.</p></div>`;
    const input=main.querySelector('#importFiles'),btn=main.querySelector('#importBtn');
    input.onchange=async()=>{ui.importFiles=[...input.files];ui.importPreview=[];main.querySelector('#importStatus').textContent='Reading files...';try{for(const file of ui.importFiles){const items=await parseImportFile(file);ui.importPreview.push(...items);}ui.importPreview=ui.importPreview.filter(p=>p.name);main.querySelector('#importStatus').textContent=`${ui.importPreview.length} place record(s) found in ${ui.importFiles.length} file(s).`;main.querySelector('#preview').innerHTML=ui.importPreview.slice(0,100).map(p=>`<div class="place-row"><div><div class="place-name">${esc(p.name)}</div><div class="meta">${esc([p.city,p.country,p.address].filter(Boolean).join(' · '))}</div></div><div class="smalltext ${hasCoords(p)?'':'muted'}">${hasCoords(p)?'Map pin':'No coordinates'}</div></div>`).join('')+(ui.importPreview.length>100?`<p class="muted">Preview limited to first 100 records.</p>`:'');btn.disabled=!ui.importPreview.length;}catch(e){console.error(e);main.querySelector('#importStatus').textContent=`Import preview failed: ${e.message}`;btn.disabled=true;}};
    btn.onclick=()=>{if(!ui.importPreview.length)return;createCheckpoint('Before Google import',`Before importing ${ui.importPreview.length} records`);let added=0,skipped=0;for(const p of ui.importPreview){if(isDuplicate(p,state.places)){skipped++;continue;}state.places.push(normalizePlace(p));added++;}saveState();ui.importPreview=[];ui.importFiles=[];alert(`Import complete: ${added} added, ${skipped} duplicate(s) skipped.`);ui.tab='places';render();};
  }

  async function parseImportFile(file){
    const text=await file.text();const name=file.name.toLowerCase();
    if(name.endsWith('.csv'))return parseCsvImport(text,file.name);
    if(name.endsWith('.json')||name.endsWith('.geojson'))return parseJsonImport(text,file.name);
    throw new Error(`Unsupported file: ${file.name}`);
  }

  function parseCsv(text){
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else{if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}else if(c!=='\r')field+=c;}}
    if(field.length||row.length){row.push(field);rows.push(row);}return rows;
  }

  function normKey(k){return String(k||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function firstValue(obj, keys){for(const key of keys){const nk=normKey(key);const found=Object.keys(obj).find(k=>normKey(k)===nk);if(found!==undefined&&obj[found]!==null&&obj[found]!==undefined&&String(obj[found]).trim()!=='')return obj[found];}return '';}

  function parseCsvImport(text,filename){
    const rows=parseCsv(text);if(rows.length<2)return[];const headers=rows[0];return rows.slice(1).map(cols=>{const o={};headers.forEach((h,i)=>o[h]=cols[i]??'');return importObjectToPlace(o,filename);}).filter(Boolean);
  }

  function parseJsonImport(text,filename){
    const data=JSON.parse(text);const out=[];
    if(data?.type==='FeatureCollection'&&Array.isArray(data.features)){
      for(const f of data.features){const props=f.properties||{};const loc=props.location||{};const coords=Array.isArray(f.geometry?.coordinates)?f.geometry.coordinates:null;const combined={...props,...loc};const p=importObjectToPlace(combined,filename);if(!p)continue;if(coords&&coords.length>=2){const lng=parseCoordinate(coords[0],-180,180),lat=parseCoordinate(coords[1],-90,90);if(lat!==null&&lng!==null){p.lat=lat;p.lng=lng;}}out.push(p);}return out;
    }
    const arr=Array.isArray(data)?data:(Array.isArray(data?.places)?data.places:Array.isArray(data?.features)?data.features:[data]);
    for(const item of arr){const props=item?.properties||item||{};const loc=props.location||{};const p=importObjectToPlace({...props,...loc},filename);if(p)out.push(p);}return out;
  }

  function importObjectToPlace(o,filename){
    if(!o||typeof o!=='object')return null;
    const sourceUrl=String(firstValue(o,['google maps url','google_maps_url','maps url','url','link'])||'').trim();
    let lat=parseCoordinate(firstValue(o,['latitude','lat']),-90,90);
    let lng=parseCoordinate(firstValue(o,['longitude','lng','lon','long']),-180,180);
    // Important v2.4 fix: only use explicit coordinates when BOTH are valid; blanks stay null,
    // allowing coordinates embedded in a Google Maps URL to be detected.
    if(lat===null||lng===null){const c=extractCoordsFromText(sourceUrl)||extractCoordsFromText(JSON.stringify(o));if(c){lat=c.lat;lng=c.lng;}}
    const name=String(firstValue(o,['title','name','place name','location name'])||'').trim();
    if(!name)return null;
    const tags=splitTags(firstValue(o,['tags','labels','list','lists']));if(filename)tags.push(filename.replace(/\.(csv|json|geojson)$/i,''));
    return normalizePlace({id:uid(),name,category:firstValue(o,['category','type','cuisine']),city:firstValue(o,['city','locality']),country:firstValue(o,['country','country name','country_code']),address:firstValue(o,['address','formatted address']),notes:firstValue(o,['note','notes','description','comment']),tags:[...new Set(tags)],sourceUrl,website:firstValue(o,['website','website url']),phone:firstValue(o,['phone','telephone']),lat,lng,createdAt:nowISO(),updatedAt:nowISO()});
  }

  function extractCoordsFromText(text){
    if(!text)return null;const s=String(text);
    const patterns=[/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:,|z|\/|$)/i,/[?&](?:query|q|ll)=(-?\d{1,2}(?:\.\d+)?)(?:%2C|,)(-?\d{1,3}(?:\.\d+)?)/i,/"latitude"\s*:\s*(-?\d{1,2}(?:\.\d+)?)[\s\S]{0,80}?"longitude"\s*:\s*(-?\d{1,3}(?:\.\d+)?)/i,/"lat"\s*:\s*(-?\d{1,2}(?:\.\d+)?)[\s\S]{0,80}?"(?:lng|lon|long)"\s*:\s*(-?\d{1,3}(?:\.\d+)?)/i];
    for(const re of patterns){const m=s.match(re);if(m){const lat=parseCoordinate(m[1],-90,90),lng=parseCoordinate(m[2],-180,180);if(lat!==null&&lng!==null)return{lat,lng};}}return null;
  }

  function normUrl(u){try{const x=new URL(u);x.hash='';return `${x.hostname}${x.pathname}${x.search}`.toLowerCase().replace(/\/$/,'');}catch{return String(u||'').trim().toLowerCase();}}
  function isDuplicate(p,list){const pu=normUrl(p.sourceUrl);const key=`${p.name}|${p.city}|${p.country}|${p.address}`.toLowerCase().replace(/\s+/g,' ').trim();return list.some(x=>{const xu=normUrl(x.sourceUrl);if(pu&&xu&&pu===xu)return true;const xk=`${x.name}|${x.city}|${x.country}|${x.address}`.toLowerCase().replace(/\s+/g,' ').trim();return key&&xk===key;});}

  function renderSettings(main){
    main.innerHTML=`<h2>Settings</h2><div class="card"><h3>Where my data is stored</h3><div class="notice"><strong>Local Test mode.</strong> ${activePlaces().length} active place(s), ${archivedPlaces().length} archived. Data is stored in this PWA/browser on this device and website origin. It is not automatically backed up to iCloud or Google Drive.</div></div>
      <div class="card"><h3>My profile</h3><label>Display name</label><input id="displayName" value="${esc(state.profile.displayName)}"><div class="toolbar"><button class="btn" id="saveProfile">Save name</button></div></div>
      <div class="card"><h3>Device backup & restore</h3><p>Export a backup after the first successful import, after major edits and before an app update or phone change.</p><div class="toolbar"><button class="btn primary" id="exportBackup">Export device backup</button><label class="btn" for="restoreFile" style="display:inline-block;margin:0">Restore device backup</label><input id="restoreFile" type="file" accept=".json,application/json" hidden></div></div>
      <div class="card"><h3>Version history</h3><p class="smalltext muted">The app keeps up to ${MAX_HISTORY} local checkpoints. Checkpoints are created before imports, edits, archive actions, permanent deletion and restores. They are also included in a full device backup.</p><div class="toolbar"><button class="btn" id="checkpoint">Save checkpoint now</button></div><div id="versions">${state.history.length?state.history.map(versionRow).join(''):'<p class="muted">No checkpoints yet.</p>'}</div></div>
      <div class="card"><h3>Archive rule</h3><div class="notice warning">Deleting an active place always moves it to Archive first. Permanent deletion is available only after you open that place from Archive. A checkpoint is made immediately before permanent deletion.</div></div>
      <div class="card"><h3>Display</h3><select id="textSize"><option value="normal">Normal text</option><option value="large">Larger text</option></select></div>
      <div class="card"><h3>Trial reset</h3><p class="smalltext muted">Use only after exporting a backup. This resets the local trial on this device.</p><button class="btn danger" id="resetTrial">Reset local trial</button></div>`;
    main.querySelector('#textSize').value=state.settings.textSize;
    main.querySelector('#saveProfile').onclick=()=>{state.profile.displayName=main.querySelector('#displayName').value.trim()||'Per';saveState();alert('Profile name saved.');};
    main.querySelector('#exportBackup').onclick=exportCurrentBackup;
    main.querySelector('#restoreFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());const snap=validateBackup(obj);if(!snap)throw new Error('This is not a valid Per\'s Favourites device backup.');if(!confirm('Restore this backup? Current local trial data will be replaced. A checkpoint of the current state will be kept first.'))return;createCheckpoint('Before device backup restore',`Before restoring ${file.name}`);state.profile=snap.profile;state.places=snap.places;state.settings=snap.settings||{};if(Array.isArray(obj.versions))state.history=[...state.history,...obj.versions.map(v=>({id:String(v.id||uid()),createdAt:v.createdAt||nowISO(),label:String(v.label||'Imported version'),reason:String(v.reason||''),snapshot:sanitizeSnapshot(v.snapshot||{})}))].slice(0,MAX_HISTORY);saveState();alert('Backup restored.');render();}catch(err){alert(`Restore failed: ${err.message}`);}finally{e.target.value='';}};
    main.querySelector('#checkpoint').onclick=()=>{createCheckpoint('Manual checkpoint','Saved manually');render();};
    main.querySelectorAll('[data-version-restore]').forEach(b=>b.onclick=()=>restoreVersion(b.dataset.versionRestore));
    main.querySelectorAll('[data-version-export]').forEach(b=>b.onclick=()=>exportVersion(b.dataset.versionExport));
    main.querySelector('#textSize').onchange=e=>{state.settings.textSize=e.target.value;saveState();render();};
    main.querySelector('#resetTrial').onclick=()=>{if(confirm('Reset the entire local trial on this device? Export a backup first.')){if(confirm('Final confirmation: erase active places, Archive, personal ratings/visits and local version history?')){[STORAGE_KEY,...LEGACY_KEYS].forEach(k=>localStorage.removeItem(k));state=blankState();ui={...ui,tab:'places',search:'',listFilter:'active'};render();}}};
  }

  function versionRow(v){return `<div class="version-row"><div class="row space"><div><strong>${esc(v.label)}</strong><div class="smalltext muted">${esc(fmtDate(v.createdAt))}${v.reason?` · ${esc(v.reason)}`:''}</div></div><div class="row"><button class="btn small" data-version-export="${esc(v.id)}">Export</button><button class="btn small" data-version-restore="${esc(v.id)}">Restore</button></div></div></div>`;}
  function restoreVersion(id){const v=state.history.find(x=>x.id===id);if(!v)return;if(!confirm(`Restore checkpoint “${v.label}” from ${fmtDate(v.createdAt)}? Current data will be checkpointed first.`))return;createCheckpoint('Before version restore',`Before restoring ${v.label}`);state.profile=JSON.parse(JSON.stringify(v.snapshot.profile));state.places=v.snapshot.places.map(normalizePlace);state.settings=JSON.parse(JSON.stringify(v.snapshot.settings||{}));saveState();render();}
  function exportVersion(id){const v=state.history.find(x=>x.id===id);if(!v)return;exportJson(backupObject(v.snapshot,`Checkpoint: ${v.label}`),`pers-favourites-version-${safeDate(v.createdAt)}.json`);}
  function validateBackup(obj){if(!obj||obj.type!=='pers-favourites-device-backup'||!obj.data||!Array.isArray(obj.data.places))return null;return sanitizeSnapshot(obj.data);}
  function safeDate(iso){return String(iso||nowISO()).slice(0,19).replace(/[:T]/g,'-');}
  function exportCurrentBackup(){return exportJson(backupObject(),`pers-favourites-device-backup-${safeDate(nowISO())}.json`);}

  function showModal(html){const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(wrap);wrap.addEventListener('click',e=>{if(e.target===wrap)closeModal();});wrap.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);}
  function closeModal(){document.querySelector('.modal-backdrop')?.remove();}
  function q(sel){return document.querySelector(sel)} function qAll(sel){return document.querySelectorAll(sel)}

  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Service worker registration failed',e)));
  render();

  // Regression hooks exist only when an explicit test harness enables them
  // before this script loads. They are not exposed in the normal PWA.
  if (window.__PF_TEST_MODE__ === true) {
    window.PersFavouritesTest = {
      parseCoordinate, extractCoordsFromText, parseCsv, importObjectToPlace, isDuplicate, escAttrUrl,
      normalizePlace, backupObject, validateBackup, archivePlaceById, restoreArchivedPlaceById,
      permanentDeleteArchivedPlaceById, getState: () => JSON.parse(JSON.stringify(state)),
      setState: (s) => { state = migrateState(s) || blankState(); saveState(); }, version: APP_VERSION
    };
  }
})();
