'use strict';

const CFG = Object.assign({version:'0.26.0',mode:'local',appName:'Pers Favourites',ownerDisplayName:'Owner',homeRegion:'',allowViewerSignup:false,supabasePublishableKey:'',supabaseAnonKey:''}, window.PERS_CONFIG || {});
const SUPABASE_PUBLIC_KEY = CFG.supabasePublishableKey || CFG.supabaseAnonKey || ''; // legacy anon key remains accepted for older rollouts
const LS_DB = `pers-v026-db:${CFG.deploymentId || location.pathname}`;
const LS_SESSION = `pers-v026-session:${CFG.deploymentId || location.pathname}`;
const LS_PUBLIC_VIEWER = `pers-v026-public-viewer:${CFG.deploymentId || location.pathname}`;
const LEGACY_SESSION = `pers-v025-session:${CFG.deploymentId || location.pathname}`;
const PHOTO_BUCKET = 'venue-photos';
const FILTER_KEYS = ['country','region','city','type','cuisine','rating','distance','price','meal','greatFor','feature','status','dietary','tag'];
const $ = id => document.getElementById(id);
const nowISO = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const clean = v => (v == null ? '' : String(v).trim());
const arr = v => Array.isArray(v) ? v.filter(Boolean).map(clean) : clean(v).split(',').map(s=>s.trim()).filter(Boolean);
const uniq = xs => [...new Set(xs.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const esc = s => clean(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl = u => { try { const x=new URL(u); return ['http:','https:','tel:'].includes(x.protocol)?x.href:''; } catch { return ''; } };

let state = null;
let session = null;
let currentUser = null;
let places = [];
let personal = {};
let visits = [];
let preferences = defaultPreferences();
let filters = defaultFilters();
let filteredPlaces = [];
let map = null;
let mapMarkers = [];
let currentPosition = null;
let mapBoundsFilter = null;
let importCandidates = [];
let archiveMode = false;
let photos = [];
let activeDetailPlaceId = '';
let authPurpose = 'owner';
let pendingContributionPlaceId = '';
const photoUrlCache = new Map();
let photoDbPromise = null;

function defaultFilters(){ return Object.fromEntries(FILTER_KEYS.map(k=>[k,''])); }
function defaultPreferences(){ return {view:'list',sort:'nearest',preferredDistance:'5',rememberFilters:false,lastLocation:{country:'',region:'',city:''},filters:defaultFilters()}; }
function defaultPublicViewerState(){return {id:uid(),personal:{},visits:[],preferences:defaultPreferences(),updatedAt:nowISO()};}
function loadPublicViewerState(){try{const raw=JSON.parse(localStorage.getItem(LS_PUBLIC_VIEWER)||'null');if(raw&&raw.id)return {id:raw.id,personal:raw.personal||{},visits:Array.isArray(raw.visits)?raw.visits:[],preferences:normalizePreferences(raw.preferences||{})};}catch{}const d=defaultPublicViewerState();localStorage.setItem(LS_PUBLIC_VIEWER,JSON.stringify(d));return d;}
function savePublicViewerState(){if(CFG.mode==='local'||session)return;const id=(currentUser?.id||'').replace(/^public:/,'')||loadPublicViewerState().id;localStorage.setItem(LS_PUBLIC_VIEWER,JSON.stringify({id,personal,visits,preferences:normalizePreferences(preferences),updatedAt:nowISO()}));}
function isAnonymousViewer(){return CFG.mode!=='local'&&!session&&currentUser?.role==='viewer';}
function normalizePreferences(raw={}){
  const p=Object.assign(defaultPreferences(),raw||{});
  p.lastLocation=Object.assign({country:'',region:'',city:''},raw?.lastLocation||{});
  p.filters=Object.assign(defaultFilters(),raw?.filters||{});
  p.lastLocation.country=clean(p.lastLocation.country);p.lastLocation.region=clean(p.lastLocation.region);p.lastLocation.city=clean(p.lastLocation.city);
  FILTER_KEYS.forEach(k=>p.filters[k]=clean(p.filters[k]));
  return p;
}
function filtersFromPreferences(raw){const p=normalizePreferences(raw);const f=p.rememberFilters?Object.assign(defaultFilters(),p.filters):defaultFilters();if(!p.rememberFilters){const loc=p.lastLocation;f.country=loc.country;f.region=loc.region;f.city=loc.city;if(!f.country&&!f.region&&!f.city&&p.lastRegion)f.city=clean(p.lastRegion);}return f;}
function defaultLocalState(){
  const ownerId='local-owner';
  return {
    schema:26, appVersion:CFG.version, createdAt:nowISO(), updatedAt:nowISO(),
    settings:{appName:CFG.appName,ownerDisplayName:CFG.ownerDisplayName,homeRegion:CFG.homeRegion,allowUserPhotos:true},
    users:[
      {id:ownerId,email:'owner@local.test',displayName:CFG.ownerDisplayName || 'Owner',role:'owner'},
      {id:'local-admin',email:'admin@local.test',displayName:'Pat (test admin)',role:'admin'},
      {id:'local-viewer',email:'viewer@local.test',displayName:'Viewer',role:'viewer'}
    ],
    activeUserId:ownerId, places:[], photos:[], personal:{}, visits:[], preferences:{}, history:[]
  };
}

function normalizeLegacyPlace(p={}){
  const status=clean(p.status).toLowerCase();
  const lat=p.lat ?? p.latitude ?? p.location?.lat ?? null;
  const lng=p.lng ?? p.lon ?? p.longitude ?? p.location?.lng ?? p.location?.lon ?? null;
  return {
    id:p.id||uid(), name:clean(p.name||p.title), placeType:clean(p.placeType||p.category||p.type), cuisine:clean(p.cuisine),
    country:clean(p.country), stateRegion:clean(p.stateRegion||p.state||p.region), city:clean(p.city||p.town), suburb:clean(p.suburb||p.neighbourhood||p.neighborhood),
    address:clean(p.address), lat:lat===''?null:(lat==null?null:+lat), lng:lng===''?null:(lng==null?null:+lng), price:clean(p.price),
    mealTypes:arr(p.mealTypes||p.meals), greatFor:arr(p.greatFor), features:arr(p.features), dietary:arr(p.dietary), tags:arr(p.tags),
    mustTry:clean(p.mustTry||p.whatToOrder||p.favouriteDish||p.favoriteDish), notes:clean(p.notes||p.listNotes||p.comment), website:clean(p.website),
    googleMapsUrl:clean(p.googleMapsUrl||p.googleUrl||p.mapsUrl||p.url), phone:clean(p.phone), bookingUrl:clean(p.bookingUrl||p.reservationUrl),
    createdAt:p.createdAt||p.created_at||nowISO(), updatedAt:p.updatedAt||p.updated_at||nowISO(),
    archivedAt:p.archivedAt||p.archived_at||(p.archived||status==='archived'?nowISO():'')
  };
}
function normalizePhotoMeta(x={}){
  return {
    id:x.id||uid(),placeId:x.placeId||x.place_id||'',uploadedBy:x.uploadedBy||x.uploaded_by||'',
    uploaderDisplayName:clean(x.uploaderDisplayName||x.uploader_display_name),uploaderRole:clean(x.uploaderRole||x.uploader_role||'viewer'),
    caption:clean(x.caption),storagePath:clean(x.storagePath||x.storage_path),mimeType:clean(x.mimeType||x.mime_type||'image/jpeg'),
    status:['pending','approved','hidden'].includes(clean(x.status))?clean(x.status):'pending',isCover:!!(x.isCover??x.is_cover),
    sortOrder:Number.isFinite(+(x.sortOrder??x.sort_order))?+(x.sortOrder??x.sort_order):0,
    createdAt:x.createdAt||x.created_at||nowISO(),updatedAt:x.updatedAt||x.updated_at||nowISO(),
    moderatedBy:x.moderatedBy||x.moderated_by||'',moderatedAt:x.moderatedAt||x.moderated_at||''
  };
}
function normalizeLegacyPersonal(raw,legacyPlaces=[]){
  const out={};
  const add=(placeId,x={})=>{if(!placeId)return;out[`local-owner:${placeId}`]={rating:+(x.rating||0),favourite:!!(x.favourite||x.saved||x.status==='favourite'),want:!!(x.want||x.wantToGo||x.want_to_visit||x.status==='want'),visited:!!(x.visited||x.status==='visited'),privateNote:clean(x.privateNote||x.private_note||x.note),lastVisited:x.lastVisited||x.last_visited||''};};
  if(Array.isArray(raw)){raw.forEach(x=>add(x.placeId||x.place_id,x));}
  else if(raw&&typeof raw==='object'){
    Object.entries(raw).forEach(([k,x])=>{
      if(k.includes(':')) out[k]=Object.assign({rating:0,favourite:false,want:false,visited:false,privateNote:'',lastVisited:''},x||{});
      else add(k,x||{});
    });
  }
  // Older builds sometimes kept rating/status on the place itself.
  legacyPlaces.forEach(p=>{if((p.rating||p.status)&&!out[`local-owner:${p.id}`])add(p.id,p);});
  return out;
}
function normalizeLocalState(d,sourceKey=''){
  const base=defaultLocalState();
  const rawPlaces=Array.isArray(d?.places)?d.places:[];
  const normalizedPlaces=rawPlaces.map(normalizeLegacyPlace).filter(p=>p.name);
  const users=Array.isArray(d?.users)&&d.users.length?d.users:base.users;
  const settings=d?.settings||{};
  const ownerName=clean(settings.ownerDisplayName||settings.owner_display_name||d?.displayName||CFG.ownerDisplayName||'Owner');
  const result={
    ...d, schema:26, appVersion:CFG.version,
    settings:{appName:clean(settings.appName||settings.app_name||CFG.appName)||'Pers Favourites',ownerDisplayName:ownerName,homeRegion:clean(settings.homeRegion||settings.home_region||CFG.homeRegion),allowUserPhotos:settings.allowUserPhotos??settings.allow_user_photos??true},
    users, activeUserId:d?.activeUserId||users[0]?.id||'local-owner', places:normalizedPlaces, photos:Array.isArray(d?.photos)?d.photos.map(normalizePhotoMeta):[],
    personal:normalizeLegacyPersonal(d?.personal,rawPlaces), visits:Array.isArray(d?.visits)?d.visits.map(v=>({id:v.id||uid(),placeId:v.placeId||v.place_id,userId:v.userId||v.user_id||'local-owner',visitedAt:v.visitedAt||v.visited_at||v.date||nowISO(),rating:+(v.rating||0),comment:clean(v.comment||v.note)})):[],
    preferences:d?.preferences&&typeof d.preferences==='object'?d.preferences:{}, history:Array.isArray(d?.history)?d.history:[],
    createdAt:d?.createdAt||d?.created_at||nowISO(), updatedAt:nowISO()
  };
  if(sourceKey&&sourceKey!==LS_DB){result.migratedFrom=sourceKey;result.migratedAt=nowISO();}
  return result;
}
function findLegacyLocalState(){
  const candidates=['persLocalTrialDbV1','persLocalTrialDbV2',`pers-v025-db:${CFG.deploymentId||location.pathname}`,`pers-v024-db:${CFG.deploymentId||location.pathname}`,`pers-v023-db:${CFG.deploymentId||location.pathname}`];
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k!==LS_DB&&(/persLocalTrialDb/i.test(k)||/pers[-_].*v0?2[345].*db/i.test(k)))candidates.push(k);}
  for(const key of uniq(candidates)){
    const raw=localStorage.getItem(key);if(!raw)continue;
    try{const d=JSON.parse(raw);const candidate=d?.data&&Array.isArray(d.data.places)?d.data:d;if(candidate&&Array.isArray(candidate.places))return {key,data:candidate};}catch{}
  }
  return null;
}
function loadLocalState(){
  const raw=localStorage.getItem(LS_DB);
  if(raw){try{return normalizeLocalState(JSON.parse(raw),LS_DB);}catch{}}
  const legacy=findLegacyLocalState();
  if(legacy){const migrated=normalizeLocalState(legacy.data,legacy.key);localStorage.setItem(LS_DB,JSON.stringify(migrated));return migrated;}
  return defaultLocalState();
}
function saveLocalState(){ if(CFG.mode!=='local') return; state.updatedAt=nowISO(); localStorage.setItem(LS_DB,JSON.stringify(state)); }
function checkpoint(reason){
  if(CFG.mode!=='local' || !state) return;
  const snap={id:uid(),at:nowISO(),reason,places:structuredClone(state.places),personal:structuredClone(state.personal),visits:structuredClone(state.visits),settings:structuredClone(state.settings),photos:structuredClone(state.photos||[])};
  state.history.unshift(snap); state.history=state.history.slice(0,20); saveLocalState();
}
function toast(msg){ const t=$('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add('hidden'),3000); }
function canEdit(){ return ['owner','admin'].includes(currentUser?.role); }
function isOwner(){ return currentUser?.role==='owner'; }
function personalKey(placeId){ return `${currentUser?.id || 'anon'}:${placeId}`; }
function getPersonal(placeId){ return personal[personalKey(placeId)] || {rating:0,favourite:false,want:false,visited:false,privateNote:'',lastVisited:''}; }
function formatRating(n){ n=Number(n)||0; return n ? `${'★'.repeat(n)}${'☆'.repeat(5-n)}` : 'Not rated'; }
function splitCsvLine(line){
  const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;
}
function haversine(lat1,lon1,lat2,lon2){const R=6371,toR=d=>d*Math.PI/180;const dLat=toR(lat2-lat1),dLon=toR(lon2-lon1);const a=Math.sin(dLat/2)**2+Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(a));}
function distanceFor(p){ if(!currentPosition || !Number.isFinite(+p.lat)||!Number.isFinite(+p.lng)) return null; return haversine(currentPosition.lat,currentPosition.lng,+p.lat,+p.lng); }

function photoDb(){
  if(!('indexedDB' in window)) return Promise.reject(new Error('Photo storage is not available in this browser.'));
  if(photoDbPromise) return photoDbPromise;
  photoDbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(`pers-v026-photos:${CFG.deploymentId||location.pathname}`,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('blobs'))req.result.createObjectStore('blobs',{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Could not open photo storage.'));
  });
  return photoDbPromise;
}
async function localPhotoPut(id,blob){const db=await photoDb();return new Promise((resolve,reject)=>{const tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').put({id,blob});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function localPhotoGet(id){const db=await photoDb();return new Promise((resolve,reject)=>{const r=db.transaction('blobs','readonly').objectStore('blobs').get(id);r.onsuccess=()=>resolve(r.result?.blob||null);r.onerror=()=>reject(r.error);});}
async function localPhotoDelete(id){const db=await photoDb();return new Promise((resolve,reject)=>{const tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
function encodeStoragePath(path){return clean(path).split('/').map(encodeURIComponent).join('/');}
async function storageUpload(path,blob){
  const base=CFG.supabaseUrl?.replace(/\/$/,'');if(!base||!SUPABASE_PUBLIC_KEY||!session?.access_token)throw new Error('Production photo storage is not configured.');
  const res=await fetch(`${base}/storage/v1/object/${PHOTO_BUCKET}/${encodeStoragePath(path)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':blob.type||'image/jpeg','x-upsert':'false'},body:blob});
  const text=await res.text();if(!res.ok){let d={};try{d=JSON.parse(text)}catch{}throw new Error(d.message||d.error||`Photo upload failed (${res.status})`);}return text;
}
async function storageDownload(path){
  const base=CFG.supabaseUrl?.replace(/\/$/,'');const res=await fetch(`${base}/storage/v1/object/authenticated/${PHOTO_BUCKET}/${encodeStoragePath(path)}`,{headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:`Bearer ${session.access_token}`}});
  if(!res.ok)throw new Error(`Photo download failed (${res.status})`);return res.blob();
}
async function storageDelete(paths){
  if(!paths.length)return;const base=CFG.supabaseUrl?.replace(/\/$/,'');const res=await fetch(`${base}/storage/v1/object/${PHOTO_BUCKET}`,{method:'DELETE',headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths})});
  if(!res.ok){const text=await res.text();throw new Error(text||`Photo deletion failed (${res.status})`);}
}
async function compressPhoto(file){
  if(!file?.type?.startsWith('image/'))throw new Error('Please select image files only.');
  if(file.size>20*1024*1024)throw new Error(`${file.name||'Photo'} is larger than 20 MB.`);
  const src=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('That image could not be read.'));i.src=src;});
    const max=1600,scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));const w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare the image.')),'image/jpeg',0.84));
  } finally {URL.revokeObjectURL(src);}
}
async function photoObjectUrl(ph){
  if(photoUrlCache.has(ph.id))return photoUrlCache.get(ph.id);
  if(CFG.mode!=='local'){const base=CFG.supabaseUrl?.replace(/\/$/,'');if(!base||!ph.storagePath)return '';const url=`${base}/storage/v1/object/public/${PHOTO_BUCKET}/${encodeStoragePath(ph.storagePath)}`;photoUrlCache.set(ph.id,url);return url;}
  const blob=await localPhotoGet(ph.id);if(!blob)return '';const url=URL.createObjectURL(blob);photoUrlCache.set(ph.id,url);return url;
}
function clearPhotoUrl(id){const u=photoUrlCache.get(id);if(u){URL.revokeObjectURL(u);photoUrlCache.delete(id);}}
function canSeePhoto(ph){return ph.status==='approved'||canEdit()||ph.uploadedBy===currentUser?.id;}
function visiblePhotosForPlace(placeId){return photos.filter(ph=>ph.placeId===placeId&&canSeePhoto(ph)).sort((a,b)=>(b.isCover-a.isCover)||(a.sortOrder-b.sortOrder)||clean(a.createdAt).localeCompare(clean(b.createdAt)));}
function approvedPhotosForPlace(placeId){return photos.filter(ph=>ph.placeId===placeId&&ph.status==='approved').sort((a,b)=>(b.isCover-a.isCover)||(a.sortOrder-b.sortOrder)||clean(a.createdAt).localeCompare(clean(b.createdAt)));}
function coverPhotoForPlace(placeId){const xs=approvedPhotosForPlace(placeId);return xs.find(x=>x.isCover)||xs[0]||null;}
function photoCredit(ph,forEditor=false){const ownerName=state?.settings?.ownerDisplayName||CFG.ownerDisplayName||'Owner';if(ph.uploaderRole==='owner')return `${ownerName} - Owner`;if(ph.uploaderRole==='admin')return 'Admin photo';return forEditor&&ph.uploaderDisplayName?`User contribution - ${ph.uploaderDisplayName}`:'User contribution';}
async function hydratePhotoImages(root=document){
  const imgs=[...root.querySelectorAll('img[data-photo-id]')];await Promise.all(imgs.map(async img=>{const ph=photos.find(x=>x.id===img.dataset.photoId);if(!ph)return;try{const u=await photoObjectUrl(ph);if(u)img.src=u;}catch{img.alt='Photo unavailable';}}));
}
function updatePendingPhotoBadge(){const n=photos.filter(x=>x.status==='pending').length;const b=$('pendingPhotoBadge');if(b){b.textContent=n;b.classList.toggle('hidden',!n);}}
function fileToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
function dataUrlToBlob(data){const [head,b64]=String(data).split(',');const mime=(head.match(/data:([^;]+)/)||[])[1]||'image/jpeg';const bin=atob(b64||'');const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:mime});}

async function api(path,{method='GET',body,token=session?.access_token,query=''}={}){
  const base=CFG.supabaseUrl?.replace(/\/$/,'');
  if(!base||!SUPABASE_PUBLIC_KEY) throw new Error('Production backend is not configured.');
  const headers={'apikey':SUPABASE_PUBLIC_KEY,'Content-Type':'application/json','Accept':'application/json'};
  if(token) headers.Authorization=`Bearer ${token}`;
  const res=await fetch(`${base}${path}${query}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok) throw new Error(data?.msg||data?.message||data?.error_description||`Request failed (${res.status})`);
  return data;
}
async function refreshSession(){
  if(!session?.refresh_token) throw new Error('Your session has expired. Please sign in again.');
  const next=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},token:null});
  session=next;localStorage.setItem(LS_SESSION,JSON.stringify(session));return session;
}
async function rest(table,{select='*',filters='',method='GET',body,prefer='return=representation',_retry=false}={}){
  const base=CFG.supabaseUrl?.replace(/\/$/,''); const headers={'apikey':SUPABASE_PUBLIC_KEY,'Authorization':`Bearer ${session.access_token}`,'Content-Type':'application/json','Prefer':prefer};
  const qs=method==='GET'?`?select=${encodeURIComponent(select)}${filters}`:filters;
  const res=await fetch(`${base}/rest/v1/${table}${qs}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  if(res.status===401&&!_retry&&session?.refresh_token){await refreshSession();return rest(table,{select,filters,method,body,prefer,_retry:true});}
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}; if(!res.ok) throw new Error(data?.message||`Database request failed (${res.status})`); return data;
}
async function publicRest(table,{select='*',filters=''}={}){
  const base=CFG.supabaseUrl?.replace(/\/$/,'');if(!base||!SUPABASE_PUBLIC_KEY)throw new Error('Production backend is not configured.');
  const res=await fetch(`${base}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`,{headers:{apikey:SUPABASE_PUBLIC_KEY,'Accept':'application/json'}});
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text};if(!res.ok)throw new Error(data?.message||`Public catalogue request failed (${res.status})`);return data;
}

async function makeCheckpoint(reason){
  if(CFG.mode==='local'){checkpoint(reason);return;}
  if(!canEdit())return;
  const snapshot={appVersion:CFG.version,at:nowISO(),settings:state?.settings||{},places};
  await rest('audit_snapshots',{method:'POST',body:{created_by:currentUser.id,reason,snapshot},prefer:'return=minimal'});
}

async function signIn(email,password){ return api('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},token:null}); }
async function sendMagicLink(email){return api('/auth/v1/otp',{method:'POST',body:{email,create_user:true,email_redirect_to:location.origin+location.pathname,data:{display_name:clean(email).split('@')[0]}},token:null});}
async function sendRecovery(email){ return api('/auth/v1/recover',{method:'POST',body:{email,redirect_to:location.origin+location.pathname},token:null}); }
async function updatePassword(token,password){ return api('/auth/v1/user',{method:'PUT',body:{password},token}); }

async function loadPublicProductionData(){
  currentUser=null;session=null;
  const s=await publicRest('app_settings');const rawSettings=s?.[0]||{};const backendDeploymentId=clean(rawSettings.deployment_id);
  if(!backendDeploymentId||backendDeploymentId==='UNCONFIGURED'||backendDeploymentId!==clean(CFG.deploymentId))throw new Error('Rollout isolation check failed. This site is not matched to its own configured database. Ask the rollout owner to check deploymentId and Supabase setup.');
  const [p,ph]=await Promise.all([publicRest('places',{filters:'&order=name.asc'}),publicRest('venue_photos',{filters:'&status=eq.approved&order=sort_order.asc,created_at.asc'})]);
  state={settings:{appName:rawSettings.app_name||CFG.appName,ownerDisplayName:rawSettings.owner_display_name||CFG.ownerDisplayName,homeRegion:rawSettings.home_region||CFG.homeRegion,allowUserPhotos:rawSettings.allow_user_photos!==false,deploymentId:backendDeploymentId}};
  places=(p||[]).map(dbPlaceToApp);photos=(ph||[]).map(normalizePhotoMeta);
  const pv=loadPublicViewerState();currentUser={id:`public:${pv.id}`,email:'',displayName:'Viewer',role:'viewer',anonymous:true};personal=pv.personal||{};visits=pv.visits||[];preferences=normalizePreferences(pv.preferences||{});filters=filtersFromPreferences(preferences);
}

async function loadProductionData(){
  const profileRows=await rest('profiles',{filters:`&id=eq.${encodeURIComponent(session.user.id)}`});
  currentUser=profileRows?.[0] || {id:session.user.id,email:session.user.email,display_name:session.user.email,role:'viewer'};
  currentUser.displayName=currentUser.display_name || currentUser.email;
  // Check rollout identity BEFORE reading catalogue/personal data. This blocks an accidental
  // configuration that points two independently deployed sites at the same database project.
  const s=await rest('app_settings');
  const rawSettings=s?.[0]||{};
  const backendDeploymentId=clean(rawSettings.deployment_id);
  if(!backendDeploymentId || backendDeploymentId==='UNCONFIGURED' || backendDeploymentId!==clean(CFG.deploymentId)){
    throw new Error('Rollout isolation check failed. This site is not matched to its own configured database. Ask the rollout owner to check deploymentId and Supabase setup.');
  }
  const [p,ph,per,v,prefs]=await Promise.all([
    rest('places',{filters:'&order=name.asc'}), rest('venue_photos',{filters:'&order=sort_order.asc,created_at.asc'}), rest('personal_place_data'), rest('visits',{filters:'&order=visited_at.desc'}), rest('user_preferences')
  ]);
  state={settings:rawSettings};
  state.settings={appName:rawSettings.app_name||CFG.appName,ownerDisplayName:rawSettings.owner_display_name||CFG.ownerDisplayName,homeRegion:rawSettings.home_region||CFG.homeRegion,allowUserPhotos:rawSettings.allow_user_photos!==false,deploymentId:backendDeploymentId};
  places=(p||[]).map(dbPlaceToApp);
  photos=(ph||[]).map(normalizePhotoMeta);
  personal={};(per||[]).forEach(x=>{personal[`${currentUser.id}:${x.place_id}`]={rating:x.rating||0,favourite:!!x.favourite,want:!!x.want_to_visit,visited:!!x.visited,privateNote:x.private_note||'',lastVisited:x.last_visited||''};});
  visits=(v||[]).map(x=>({id:x.id,placeId:x.place_id,userId:x.user_id,visitedAt:x.visited_at,rating:x.rating,comment:x.comment||''}));
  const pr=prefs?.[0];preferences=normalizePreferences(pr?.preferences||{});
  filters=filtersFromPreferences(preferences);
}
function dbPlaceToApp(x){return {id:x.id,name:x.name||'',placeType:x.place_type||'',cuisine:x.cuisine||'',country:x.country||'',stateRegion:x.state_region||'',city:x.city||'',suburb:x.suburb||'',address:x.address||'',lat:x.lat,lng:x.lng,price:x.price||'',mealTypes:x.meal_types||[],greatFor:x.great_for||[],features:x.features||[],dietary:x.dietary||[],tags:x.tags||[],mustTry:x.must_try||'',notes:x.notes||'',website:x.website||'',googleMapsUrl:x.google_maps_url||'',phone:x.phone||'',bookingUrl:x.booking_url||'',createdAt:x.created_at,updatedAt:x.updated_at,archivedAt:x.archived_at||''};}
function appPlaceToDb(p){return {name:p.name,place_type:p.placeType||null,cuisine:p.cuisine||null,country:p.country||null,state_region:p.stateRegion||null,city:p.city||null,suburb:p.suburb||null,address:p.address||null,lat:p.lat||null,lng:p.lng||null,price:p.price||null,meal_types:p.mealTypes||[],great_for:p.greatFor||[],features:p.features||[],dietary:p.dietary||[],tags:p.tags||[],must_try:p.mustTry||null,notes:p.notes||null,website:p.website||null,google_maps_url:p.googleMapsUrl||null,phone:p.phone||null,booking_url:p.bookingUrl||null,archived_at:p.archivedAt||null};}

async function boot(){
  setBranding();
  bindEvents();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  if(CFG.mode==='local'){
    state=loadLocalState();
    const started=localStorage.getItem(LS_SESSION)==='local-started'||localStorage.getItem(LEGACY_SESSION)==='local-started';if(started&&!localStorage.getItem(LS_SESSION))localStorage.setItem(LS_SESSION,'local-started');
    if(!started){$('localStartScreen').classList.remove('hidden');return;}
    await enterLocal();return;
  }
  const hp=new URLSearchParams(location.hash.replace(/^#/,''));
  if(hp.get('type')==='recovery'&&hp.get('access_token')){session={access_token:hp.get('access_token'),refresh_token:hp.get('refresh_token'),user:{id:''}};$('newPasswordDialog').showModal();return;}
  if(hp.get('access_token')){session={access_token:hp.get('access_token'),refresh_token:hp.get('refresh_token'),user:{id:''}};localStorage.setItem(LS_SESSION,JSON.stringify(session));history.replaceState(null,'',location.pathname);}
  let saved=localStorage.getItem(LS_SESSION);if(!saved){const legacy=localStorage.getItem(LEGACY_SESSION);if(legacy){saved=legacy;localStorage.setItem(LS_SESSION,legacy);}}
  if(saved&&!session){try{session=JSON.parse(saved);}catch{localStorage.removeItem(LS_SESSION);session=null;}}
  if(session){try{await hydrateSessionUser();await enterProduction();return;}catch{localStorage.removeItem(LS_SESSION);session=null;}}
  try{await enterPublicProduction();}catch(e){$('appScreen').classList.remove('hidden');$('resultCount').textContent=e.message;toast(e.message);}
}
async function hydrateSessionUser(){ try{const u=await api('/auth/v1/user');session.user=u;}catch(e){if(session?.refresh_token){await refreshSession();const u=await api('/auth/v1/user');session.user=u;}else throw e;} }
async function enterLocal(){
  state=loadLocalState();currentUser=state.users.find(u=>u.id===state.activeUserId)||state.users[0];places=state.places;photos=state.photos||[];personal=state.personal;visits=state.visits;preferences=normalizePreferences(state.preferences[currentUser.id]||{});filters=filtersFromPreferences(preferences);showApp();
}
async function enterProduction(){await loadProductionData();showApp();}
async function enterPublicProduction(){await loadPublicProductionData();showApp();}
function showApp(){
  if($('authScreen')?.open)$('authScreen').close();$('localStartScreen').classList.add('hidden');$('appScreen').classList.remove('hidden');
  setBranding();applyPreferencesToUI();populateFilterOptions();render();
  if(CFG.mode!=='local'&&session){const pending=sessionStorage.getItem('pers-v026-pending-photo-place');if(pending&&places.some(p=>p.id===pending)){sessionStorage.removeItem('pers-v026-pending-photo-place');setTimeout(()=>openDetail(pending),150);}}
}
function setBranding(){const s=state?.settings||{};const name=s.appName||CFG.appName;const region=s.homeRegion||CFG.homeRegion||'Personal places';if(window.PERS_BRANDING?.apply)window.PERS_BRANDING.apply(name,region);else{$('appTitle').textContent=name;document.title=name;$('homeRegionLabel').textContent=region;}$('versionLabel').textContent=CFG.version;}
function applyPreferencesToUI(){$('sortSelect').value=preferences.sort||'nearest';$('prefDistance').value=preferences.preferredDistance||'5';$('rememberFilters').checked=!!preferences.rememberFilters;setView(preferences.view||'list',false);syncFilterControls();}
function syncFilterControls(){
  const map={country:'countryFilter',region:'regionFilter',city:'cityFilter',type:'typeFilter',cuisine:'cuisineFilter',rating:'ratingFilter',distance:'distanceFilter',price:'priceFilter',meal:'mealFilter',greatFor:'greatForFilter',feature:'featureFilter',status:'statusFilter',dietary:'dietaryFilter',tag:'tagFilter'};
  Object.entries(map).forEach(([k,id])=>{if($(id)) $(id).value=filters[k]||'';});
}
function populateSelect(id,label,values,current=''){const el=$(id);const first=el.querySelector('option')?.outerHTML||`<option value="">${esc(label)}</option>`;el.innerHTML=first+values.map(v=>{const item=typeof v==='string'?{value:v,label:v}:v;return `<option value="${esc(item.value)}">${esc(item.label)}</option>`;}).join('');el.value=current||'';}
function counted(values){const m=new Map();values.filter(Boolean).forEach(v=>m.set(v,(m.get(v)||0)+1));return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([value,count])=>({value,label:`${value} (${count})`}));}
function populateFilterOptions(){
  const active=places.filter(p=>!p.archivedAt);
  populateSelect('countryFilter','Country',counted(active.map(p=>p.country)),filters.country);
  const rset=active.filter(p=>!filters.country||p.country===filters.country);populateSelect('regionFilter','State/Region',counted(rset.map(p=>p.stateRegion)),filters.region);
  const cset=rset.filter(p=>!filters.region||p.stateRegion===filters.region);populateSelect('cityFilter','City/Town',counted(cset.map(p=>p.city)),filters.city);
  populateSelect('typeFilter','Place Type',counted(active.map(p=>p.placeType)),filters.type);populateSelect('cuisineFilter','Cuisine',counted(active.map(p=>p.cuisine)),filters.cuisine);
  populateSelect('mealFilter','Meal / Visit Type',counted(active.flatMap(p=>p.mealTypes||[])),filters.meal);populateSelect('greatForFilter','Great For',counted(active.flatMap(p=>p.greatFor||[])),filters.greatFor);
  populateSelect('featureFilter','Feature',counted(active.flatMap(p=>p.features||[])),filters.feature);populateSelect('dietaryFilter','Dietary',counted(active.flatMap(p=>p.dietary||[])),filters.dietary);populateSelect('tagFilter','Personal Tag',counted(active.flatMap(p=>p.tags||[])),filters.tag);
  syncFilterControls();
}
function filterCountLabel(label,count){return count?`${label} (${count})`:label;}
function applyFilters(){
  let xs=places.filter(p=>archiveMode?!!p.archivedAt:!p.archivedAt);
  const q=clean($('searchInput').value).toLowerCase();
  if(q) xs=xs.filter(p=>[p.name,p.placeType,p.cuisine,p.country,p.stateRegion,p.city,p.suburb,p.address,p.notes,p.mustTry,...(p.tags||[])].join(' ').toLowerCase().includes(q));
  if(filters.country) xs=xs.filter(p=>p.country===filters.country);if(filters.region) xs=xs.filter(p=>p.stateRegion===filters.region);if(filters.city) xs=xs.filter(p=>p.city===filters.city);if(filters.type) xs=xs.filter(p=>p.placeType===filters.type);if(filters.cuisine) xs=xs.filter(p=>p.cuisine===filters.cuisine);if(filters.price) xs=xs.filter(p=>p.price===filters.price);
  if(filters.meal) xs=xs.filter(p=>(p.mealTypes||[]).includes(filters.meal));if(filters.greatFor) xs=xs.filter(p=>(p.greatFor||[]).includes(filters.greatFor));if(filters.feature) xs=xs.filter(p=>(p.features||[]).includes(filters.feature));if(filters.dietary) xs=xs.filter(p=>(p.dietary||[]).includes(filters.dietary));if(filters.tag) xs=xs.filter(p=>(p.tags||[]).includes(filters.tag));
  if(filters.rating) xs=xs.filter(p=>+getPersonal(p.id).rating>=+filters.rating);if(filters.distance) xs=xs.filter(p=>{const d=distanceFor(p);return d!=null&&d<=+filters.distance;});
  if(filters.status){xs=xs.filter(p=>{const x=getPersonal(p.id);switch(filters.status){case'favourite':return x.favourite;case'want':return x.want;case'visited':return x.visited;case'regular':return x.favourite&&x.visited;case'unrated':return !x.rating;default:return true;}});}
  if(mapBoundsFilter && map){xs=xs.filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&mapBoundsFilter.contains([+p.lat,+p.lng]));}
  const sort=$('sortSelect').value;
  xs.sort((a,b)=>{if(sort==='name')return a.name.localeCompare(b.name);if(sort==='rating')return (+getPersonal(b.id).rating)-(+getPersonal(a.id).rating);if(sort==='recent')return clean(b.createdAt).localeCompare(clean(a.createdAt));if(sort==='visited')return clean(getPersonal(b.id).lastVisited).localeCompare(clean(getPersonal(a.id).lastVisited));if(sort==='price')return (a.price?.length||9)-(b.price?.length||9);const da=distanceFor(a),db=distanceFor(b);return (da??Infinity)-(db??Infinity)||a.name.localeCompare(b.name);});
  filteredPlaces=xs;return xs;
}
function render(){applyFilters();renderChips();renderList();if(preferences.view==='map')renderMap();$('resultCount').textContent=`${filteredPlaces.length} ${filteredPlaces.length===1?'place':'places'}${archiveMode?' in Archive':''}`;$('adminActions').classList.toggle('hidden',!canEdit()||archiveMode);updatePendingPhotoBadge();persistPreferences();}
function renderChips(){
  const labels={country:'Country',region:'Region',city:'City',type:'Type',cuisine:'Cuisine',rating:'Rating',distance:'Distance',price:'Price',meal:'Meal',greatFor:'Great for',feature:'Feature',status:'Status',dietary:'Dietary',tag:'Tag'};
  $('activeChips').innerHTML=Object.entries(filters).filter(([,v])=>v).map(([k,v])=>`<span class="chip">${esc(labels[k])}: ${esc(v)} <button data-clear-filter="${k}" aria-label="Clear">×</button></span>`).join('')+(mapBoundsFilter?`<span class="chip">Map area <button data-clear-area="1">×</button></span>`:'');
}
function renderList(){
  const box=$('listPanel');if(!filteredPlaces.length){box.innerHTML='<div class="empty">No places match these filters.</div>';return;}
  box.innerHTML=filteredPlaces.map(p=>{
    const x=getPersonal(p.id),d=distanceFor(p),meta=[p.placeType,p.cuisine,p.city,p.price,d!=null?`${d<1?Math.round(d*1000)+' m':d.toFixed(1)+' km'}`:''].filter(Boolean).join(' · ');const status=x.want?'Want to Visit':x.visited?'Visited':x.favourite?'Favourite':'';const cover=coverPhotoForPlace(p.id);const initials=esc(p.name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'PF');
    const visual=cover?`<img class="place-card-cover" data-photo-id="${cover.id}" alt="Photo of ${esc(p.name)}" />`:`<div class="place-card-placeholder">${initials}</div>`;
    return `<article class="place-card ${cover?'has-photo':''}" data-place="${p.id}">${visual}<div class="place-card-inner"><div class="place-card-top"><div><h3>${esc(p.name)}</h3><div class="meta">${esc(meta)}</div>${status?`<span class="status-pill">${esc(status)}</span>`:''}</div><div class="rating">${esc(formatRating(x.rating))}</div></div>${p.mustTry?`<div class="must-try"><strong>Must try:</strong> ${esc(p.mustTry)}</div>`:''}<div class="card-actions"><button data-open="${p.id}">Open venue</button>${safeUrl(p.googleMapsUrl)?`<a href="${esc(safeUrl(p.googleMapsUrl))}" target="_blank" rel="noopener">Directions</a>`:''}${safeUrl(p.website)?`<a href="${esc(safeUrl(p.website))}" target="_blank" rel="noopener">Website</a>`:''}${p.phone?`<a href="tel:${esc(p.phone.replace(/[^+\d]/g,''))}">Call</a>`:''}${safeUrl(p.bookingUrl)?`<a href="${esc(safeUrl(p.bookingUrl))}" target="_blank" rel="noopener">Book</a>`:''}${canEdit()?`<button data-edit="${p.id}">Edit</button>`:''}</div></div></article>`;
  }).join('');hydratePhotoImages(box);
}
function ensureMap(){
  if(map || !window.L) return;
  map=L.map('map',{zoomControl:true}).setView([20,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  map.on('moveend',()=>{$('searchAreaBtn').classList.remove('hidden');});
}
function renderMap(){
  ensureMap();if(!map)return;setTimeout(()=>map.invalidateSize(),0);mapMarkers.forEach(m=>m.remove());mapMarkers=[];
  const mappable=filteredPlaces.filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lng));
  for(const p of mappable){const m=L.marker([+p.lat,+p.lng]).addTo(map).bindPopup(`<strong>${esc(p.name)}</strong><br>${esc([p.cuisine,p.city].filter(Boolean).join(' · '))}<br><button onclick="window.PERS_TEST.openPlace('${p.id}')">Open</button>`);mapMarkers.push(m);}
  if(currentPosition){mapMarkers.push(L.circleMarker([currentPosition.lat,currentPosition.lng],{radius:7}).addTo(map).bindPopup('My location'));}
  if(mappable.length && !mapBoundsFilter){const b=L.latLngBounds(mappable.map(p=>[+p.lat,+p.lng]));map.fitBounds(b.pad(.12),{maxZoom:15});}
}
function setView(v,rerender=true){preferences.view=v;$('listPanel').classList.toggle('hidden',v!=='list');$('mapPanel').classList.toggle('hidden',v!=='map');$('listViewBtn').classList.toggle('active',v==='list');$('mapViewBtn').classList.toggle('active',v==='map');if(v==='map')setTimeout(()=>{ensureMap();renderMap();},20);if(rerender)render();}
async function persistPreferences(targetUserId=currentUser?.id){
  if(!targetUserId||!currentUser)return;
  preferences.sort=$('sortSelect').value;preferences.preferredDistance=$('prefDistance').value;preferences.rememberFilters=$('rememberFilters').checked;
  preferences.filters=preferences.rememberFilters?structuredClone(filters):defaultFilters();
  preferences.lastLocation={country:filters.country||'',region:filters.region||'',city:filters.city||''};
  const snapshot=normalizePreferences(structuredClone(preferences));
  if(CFG.mode==='local'){state.preferences[targetUserId]=snapshot;saveLocalState();return;}
  if(isAnonymousViewer()){preferences=snapshot;savePublicViewerState();return;}
  try{await rest('user_preferences',{method:'POST',body:{user_id:targetUserId,preferences:snapshot},filters:'?on_conflict=user_id',prefer:'resolution=merge-duplicates,return=minimal'});}catch{}
}

function renderPhotoGallery(placeId){
  const xs=visiblePhotosForPlace(placeId);const ownerName=state?.settings?.ownerDisplayName||CFG.ownerDisplayName||'Owner';
  const tiles=xs.map(ph=>{
    const statusClass=ph.status==='pending'?'pending':ph.status==='hidden'?'hidden-status':'';const ownerClass=ph.uploaderRole==='owner'?'owner':'';
    const manage=canEdit()?`<div class="photo-actions"><button data-photo-caption="${ph.id}">Caption</button>${ph.status!=='approved'?`<button data-photo-approve="${ph.id}">Approve</button>`:''}${ph.status!=='hidden'?`<button data-photo-hide="${ph.id}">Hide</button>`:''}${ph.status==='approved'&&!ph.isCover?`<button data-photo-cover="${ph.id}">Set cover</button>`:''}${ph.status==='approved'&&!ph.isCover?`<button data-photo-earlier="${ph.id}">Move earlier</button><button data-photo-later="${ph.id}">Move later</button>`:''}<button data-photo-delete="${ph.id}">Delete</button></div>`:(ph.uploadedBy===currentUser?.id?`<div class="photo-actions"><button data-photo-delete="${ph.id}">Remove my photo</button></div>`:'');
    return `<div class="photo-tile"><button class="photo-open-button" data-photo-open="${ph.id}" aria-label="Open photo"><img data-photo-id="${ph.id}" alt="Venue photo" /></button><div class="photo-tile-body"><p class="photo-caption">${esc(ph.caption||'')}</p><div class="photo-credit">${esc(photoCredit(ph,canEdit()))}</div><div class="detail-badges">${ph.isCover?'<span class="photo-badge">Cover</span>':''}<span class="photo-badge ${statusClass} ${ownerClass}">${esc(ph.status==='approved'?'Visible':ph.status==='pending'?'Pending approval':'Hidden')}</span></div></div>${manage}</div>`;
  }).join('');
  const contributionOpen=state?.settings?.allowUserPhotos!==false;const addButton=(canEdit()||contributionOpen)?`<button class="primary compact" data-add-photo="${placeId}">+ Add photos</button>`:'';const note=canEdit()?`Owner/Admin uploads appear immediately. User uploads require approval before other users see them.`:(contributionOpen?`You can contribute photos. If you are not signed in, the app will ask for your email only when you upload. The ${esc(ownerName)} collection Owner/Admin approves user photos before they appear to everyone.`:`User photo contributions are currently turned off by the Owner.`);return `<section class="photo-section"><div class="photo-section-head"><div><strong>Venue photos</strong><div class="muted small">${xs.length?`${xs.length} available to you`:'No photos yet'}</div></div>${addButton}</div><p class="photo-upload-note">${note}</p><div class="photo-strip">${tiles||'<div class="empty">No venue photos yet.</div>'}</div></section>`;
}
function openDetail(id){
  const p=places.find(x=>x.id===id);if(!p)return;activeDetailPlaceId=id;const x=getPersonal(id);$('detailName').textContent=p.name;
  const d=distanceFor(p),cover=coverPhotoForPlace(id),ownerName=state?.settings?.ownerDisplayName||CFG.ownerDisplayName||'Owner';const hero=cover?`<div class="detail-hero"><img data-photo-id="${cover.id}" alt="Photo of ${esc(p.name)}" /></div>`:`<div class="detail-hero"><div class="detail-hero-empty">${esc(p.name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'PF')}</div></div>`;
  $('detailBody').innerHTML=`${hero}<div class="detail-grid"><div class="k">Type</div><div>${esc([p.placeType,p.cuisine].filter(Boolean).join(' · ')||'—')}</div><div class="k">Location</div><div>${esc([p.suburb,p.city,p.stateRegion,p.country].filter(Boolean).join(', ')||'—')}</div><div class="k">Distance</div><div>${d==null?'—':esc(d<1?Math.round(d*1000)+' m':d.toFixed(1)+' km')}</div><div class="k">Price</div><div>${esc(p.price||'—')}</div><div class="k">Must try</div><div>${esc(p.mustTry||'—')}</div><div class="k">${esc(ownerName)} says</div><div>${esc(p.notes||'—')}</div><div class="k">Tags</div><div>${esc((p.tags||[]).join(', ')||'—')}</div></div>
  ${renderPhotoGallery(id)}
  <div class="personal-panel"><strong>My view</strong><div class="stars" data-stars="${id}">${[1,2,3,4,5].map(n=>`<button data-rate="${n}" class="${n<=x.rating?'on':''}" aria-label="${n} stars">★</button>`).join('')}</div><label class="check"><input type="checkbox" data-personal="favourite" ${x.favourite?'checked':''}> Favourite</label><label class="check"><input type="checkbox" data-personal="want" ${x.want?'checked':''}> Want to Visit</label><label class="check"><input type="checkbox" data-personal="visited" ${x.visited?'checked':''}> Visited</label><label>Private note<textarea id="detailPrivateNote" rows="2">${esc(x.privateNote||'')}</textarea></label><button class="secondary" data-save-personal="${id}">Save my details</button>${x.visited?` <button class="secondary" data-log-visit="${id}">Log visit</button>`:''}</div>
  <div class="card-actions">${safeUrl(p.googleMapsUrl)?`<a href="${esc(safeUrl(p.googleMapsUrl))}" target="_blank" rel="noopener">Directions</a><a href="${esc(safeUrl(p.googleMapsUrl))}" target="_blank" rel="noopener">Google reviews & photos</a>`:''}${safeUrl(p.website)?`<a href="${esc(safeUrl(p.website))}" target="_blank" rel="noopener">Website</a>`:''}${safeUrl(p.bookingUrl)?`<a href="${esc(safeUrl(p.bookingUrl))}" target="_blank" rel="noopener">Book</a>`:''}<button data-share="${p.id}">Share</button>${canEdit()?`<button data-edit="${p.id}">Edit venue</button>`:''}</div>`;
  if(!$('detailDialog').open)$('detailDialog').showModal();hydratePhotoImages($('detailBody'));
}

async function savePersonalFromDetail(id){
  const old=getPersonal(id);const next={...old,privateNote:$('detailPrivateNote').value};$('detailBody').querySelectorAll('[data-personal]').forEach(el=>next[el.dataset.personal]=el.checked);
  personal[personalKey(id)]=next;if(CFG.mode==='local'){state.personal=personal;saveLocalState();}else if(isAnonymousViewer()){savePublicViewerState();}else await rest('personal_place_data',{method:'POST',body:{user_id:currentUser.id,place_id:id,rating:next.rating,favourite:next.favourite,want_to_visit:next.want,visited:next.visited,private_note:next.privateNote,last_visited:next.lastVisited||null},filters:'?on_conflict=user_id,place_id',prefer:'resolution=merge-duplicates,return=minimal'});toast('Personal details saved');render();
}
async function setRating(id,n){const x=getPersonal(id);x.rating=n;personal[personalKey(id)]=x;if(CFG.mode==='local'){state.personal=personal;saveLocalState();}else await savePersonalFromDetail(id);openDetail(id);}
async function logVisit(id){const rating=getPersonal(id).rating||0;const comment=prompt('Optional private visit comment:','')||'';const at=nowISO();const v={id:uid(),placeId:id,userId:currentUser.id,visitedAt:at,rating,comment};visits.unshift(v);const x=getPersonal(id);x.visited=true;x.lastVisited=at;personal[personalKey(id)]=x;if(CFG.mode==='local'){state.visits=visits;state.personal=personal;saveLocalState();}else if(isAnonymousViewer()){savePublicViewerState();}else{await rest('visits',{method:'POST',body:{place_id:id,user_id:currentUser.id,visited_at:at,rating:rating||null,comment}});await savePersonalFromDetail(id);}toast('Visit logged');openDetail(id);render();}
function sharePlace(id){const p=places.find(x=>x.id===id);if(!p)return;const text=`${p.name}${p.city?` - ${p.city}`:''}${p.mustTry?`\nMust try: ${p.mustTry}`:''}${p.googleMapsUrl?`\n${p.googleMapsUrl}`:''}`;if(navigator.share)navigator.share({title:p.name,text}).catch(()=>{});else navigator.clipboard?.writeText(text).then(()=>toast('Place copied to clipboard'));}

async function addPhotos(placeId,files){
  if(!canEdit()&&state?.settings?.allowUserPhotos===false){toast('The Owner has turned off user photo contributions.');return;}
  if(CFG.mode!=='local'&&isAnonymousViewer()){pendingContributionPlaceId=placeId;openAuth('contributor');toast('Sign in by email to contribute photos.');return;}
  if(!currentUser)return;const chosen=[...(files||[])].slice(0,8);if(!chosen.length)return;const existingCover=!!coverPhotoForPlace(placeId);let added=0;
  for(const file of chosen){
    try{
      const blob=await compressPhoto(file),id=uid(),editor=canEdit();const ph=normalizePhotoMeta({id,placeId,uploadedBy:currentUser.id,uploaderDisplayName:currentUser.displayName||'',uploaderRole:currentUser.role||'viewer',caption:'',mimeType:'image/jpeg',status:editor?'approved':'pending',isCover:editor&&!existingCover&&added===0,sortOrder:photos.filter(x=>x.placeId===placeId).length+added,createdAt:nowISO(),updatedAt:nowISO()});
      if(CFG.mode==='local'){await localPhotoPut(id,blob);ph.storagePath=`local/${id}.jpg`;photos.push(ph);state.photos=photos;saveLocalState();}
      else{
        ph.storagePath=`${placeId}/${currentUser.id}/${id}.jpg`;await storageUpload(ph.storagePath,blob);
        try{const rows=await rest('venue_photos',{method:'POST',body:{id:ph.id,place_id:ph.placeId,uploaded_by:ph.uploadedBy,uploader_display_name:ph.uploaderDisplayName,uploader_role:ph.uploaderRole,caption:ph.caption,storage_path:ph.storagePath,mime_type:ph.mimeType,status:ph.status,is_cover:ph.isCover,sort_order:ph.sortOrder}});if(rows?.[0])Object.assign(ph,normalizePhotoMeta(rows[0]));photos.push(ph);}catch(e){try{await storageDelete([ph.storagePath]);}catch{}throw e;}
      }
      added++;
    }catch(e){toast(e.message||'A photo could not be added.');}
  }
  updatePendingPhotoBadge();if(activeDetailPlaceId===placeId)openDetail(placeId);render();if(added)toast(canEdit()?`${added} photo${added===1?'':'s'} added.`:`${added} photo${added===1?'':'s'} sent for Owner/Admin approval.`);
}
async function setPhotoState(id,status){
  if(!canEdit())return;const ph=photos.find(x=>x.id===id);if(!ph)return;const next={status,updatedAt:nowISO(),moderatedBy:currentUser.id,moderatedAt:nowISO()};if(status!=='approved')next.isCover=false;
  if(CFG.mode==='local'){Object.assign(ph,next);state.photos=photos;saveLocalState();}
  else{await rest('venue_photos',{method:'PATCH',body:{status,is_cover:status==='approved'?ph.isCover:false,moderated_by:currentUser.id,moderated_at:next.moderatedAt},filters:`?id=eq.${encodeURIComponent(id)}`});Object.assign(ph,next);}
  if(status==='approved'&&!coverPhotoForPlace(ph.placeId))await setCoverPhoto(id);updatePendingPhotoBadge();if(activeDetailPlaceId===ph.placeId)openDetail(ph.placeId);if($('photoModerationDialog').open)renderPhotoModeration();render();
}
async function setCoverPhoto(id){
  if(!canEdit())return;const ph=photos.find(x=>x.id===id);if(!ph||ph.status!=='approved')return toast('Approve the photo before making it the cover.');
  const siblings=photos.filter(x=>x.placeId===ph.placeId&&x.id!==id&&x.isCover);if(CFG.mode==='local'){siblings.forEach(x=>x.isCover=false);ph.isCover=true;state.photos=photos;saveLocalState();}
  else{if(siblings.length)await rest('venue_photos',{method:'PATCH',body:{is_cover:false},filters:`?place_id=eq.${encodeURIComponent(ph.placeId)}&is_cover=eq.true`});await rest('venue_photos',{method:'PATCH',body:{is_cover:true,status:'approved'},filters:`?id=eq.${encodeURIComponent(id)}`});siblings.forEach(x=>x.isCover=false);ph.isCover=true;}
  if(activeDetailPlaceId===ph.placeId)openDetail(ph.placeId);if($('photoModerationDialog').open)renderPhotoModeration();render();toast('Cover photo updated.');
}
async function movePhoto(id,direction){
  if(!canEdit())return;const ph=photos.find(x=>x.id===id);if(!ph||ph.status!=='approved')return;
  const xs=approvedPhotosForPlace(ph.placeId).filter(x=>!x.isCover||x.id===ph.id);const i=xs.findIndex(x=>x.id===id);const j=direction<0?i-1:i+1;if(i<0||j<0||j>=xs.length)return toast(direction<0?'Already first in the photo order.':'Already last in the photo order.');
  const other=xs[j],a=Number.isFinite(+ph.sortOrder)?+ph.sortOrder:i,b=Number.isFinite(+other.sortOrder)?+other.sortOrder:j;ph.sortOrder=b;other.sortOrder=a;ph.updatedAt=other.updatedAt=nowISO();
  if(CFG.mode==='local'){state.photos=photos;saveLocalState();}else{await Promise.all([rest('venue_photos',{method:'PATCH',body:{sort_order:ph.sortOrder},filters:`?id=eq.${encodeURIComponent(ph.id)}`}),rest('venue_photos',{method:'PATCH',body:{sort_order:other.sortOrder},filters:`?id=eq.${encodeURIComponent(other.id)}`})]);}
  if(activeDetailPlaceId===ph.placeId)openDetail(ph.placeId);if($('photoModerationDialog').open)renderPhotoModeration();render();
}
async function editPhotoCaption(id){
  if(!canEdit())return;const ph=photos.find(x=>x.id===id);if(!ph)return;const next=prompt('Photo caption:',ph.caption||'');if(next===null)return;ph.caption=clean(next);ph.updatedAt=nowISO();if(CFG.mode==='local'){state.photos=photos;saveLocalState();}else await rest('venue_photos',{method:'PATCH',body:{caption:ph.caption},filters:`?id=eq.${encodeURIComponent(id)}`});if(activeDetailPlaceId===ph.placeId)openDetail(ph.placeId);if($('photoModerationDialog').open)renderPhotoModeration();
}
async function deletePhoto(id){
  const ph=photos.find(x=>x.id===id);if(!ph)return;const allowed=canEdit()||ph.uploadedBy===currentUser?.id;if(!allowed)return;if(!confirm('Permanently remove this photo? This removes the image file as well as its catalogue entry.'))return;
  try{
    if(CFG.mode==='local')await localPhotoDelete(ph.id);else await storageDelete([ph.storagePath]);
    if(CFG.mode!=='local')await rest('venue_photos',{method:'DELETE',filters:`?id=eq.${encodeURIComponent(id)}`,prefer:'return=minimal'});
    photos=photos.filter(x=>x.id!==id);if(CFG.mode==='local'){state.photos=photos;saveLocalState();}clearPhotoUrl(id);
    const next=approvedPhotosForPlace(ph.placeId)[0];if(ph.isCover&&next)await setCoverPhoto(next.id);updatePendingPhotoBadge();if(activeDetailPlaceId===ph.placeId)openDetail(ph.placeId);if($('photoModerationDialog').open)renderPhotoModeration();render();toast('Photo removed.');
  }catch(e){toast(e.message||'Photo could not be removed.');}
}
function openPhotoViewer(id){const ph=photos.find(x=>x.id===id);if(!ph||!canSeePhoto(ph))return;const place=places.find(x=>x.id===ph.placeId);$('photoViewerTitle').textContent=place?.name||'Venue photo';$('photoViewerMeta').textContent=`${photoCredit(ph,canEdit())} · ${ph.status}`;$('photoViewerCaption').textContent=ph.caption||'';$('photoViewerImage').removeAttribute('src');photoObjectUrl(ph).then(u=>{if(u)$('photoViewerImage').src=u;}).catch(()=>{});$('photoViewerDialog').showModal();}
function renderPhotoModeration(){
  if(!canEdit())return;const mode=$('photoModerationFilter').value;let xs=photos.slice().sort((a,b)=>clean(b.createdAt).localeCompare(clean(a.createdAt)));if(mode!=='all')xs=xs.filter(x=>x.status===mode);$('photoModerationCount').textContent=`${xs.length} ${xs.length===1?'photo':'photos'}`;
  $('photoModerationList').innerHTML=xs.length?xs.map(ph=>{const pl=places.find(x=>x.id===ph.placeId);return `<div class="moderation-row"><img data-photo-id="${ph.id}" alt="Venue photo"/><div><div class="moderation-title">${esc(pl?.name||'Unknown venue')}</div><div class="moderation-meta">${esc(photoCredit(ph,true))} · ${esc(ph.status)}${ph.isCover?' · Cover':''}</div>${ph.caption?`<div class="small">${esc(ph.caption)}</div>`:''}<div class="moderation-actions"><button data-photo-open="${ph.id}">Open</button><button data-photo-caption="${ph.id}">Caption</button>${ph.status!=='approved'?`<button data-photo-approve="${ph.id}">Approve</button>`:''}${ph.status!=='hidden'?`<button data-photo-hide="${ph.id}">Hide</button>`:''}${ph.status==='approved'&&!ph.isCover?`<button data-photo-cover="${ph.id}">Set cover</button>`:''}${ph.status==='approved'&&!ph.isCover?`<button data-photo-earlier="${ph.id}">Earlier</button><button data-photo-later="${ph.id}">Later</button>`:''}<button class="danger-secondary" data-photo-delete="${ph.id}">Delete</button></div></div></div>`;}).join(''):'<div class="empty">No photos in this category.</div>';hydratePhotoImages($('photoModerationList'));
}
function openPhotoModeration(){if(!canEdit())return;$('photoModerationFilter').value='pending';renderPhotoModeration();$('photoModerationDialog').showModal();}

function openPlaceEditor(id=''){
  if(!canEdit())return toast('This account is read-only.');const p=id?places.find(x=>x.id===id):null;$('placeDialogTitle').textContent=p?(p.archivedAt?'Archived place':'Edit place'):'Add place';$('placeId').value=p?.id||'';
  const vals={placeName:p?.name,placeType:p?.placeType,placeCuisine:p?.cuisine,placeCountry:p?.country,placeRegion:p?.stateRegion,placeCity:p?.city,placeSuburb:p?.suburb,placeAddress:p?.address,placeLat:p?.lat,placeLng:p?.lng,placePrice:p?.price,placePhone:p?.phone,placeWebsite:p?.website,placeGoogleUrl:p?.googleMapsUrl,placeBookingUrl:p?.bookingUrl,placeMeals:(p?.mealTypes||[]).join(', '),placeGreatFor:(p?.greatFor||[]).join(', '),placeFeatures:(p?.features||[]).join(', '),placeDietary:(p?.dietary||[]).join(', '),placeTags:(p?.tags||[]).join(', '),placeMustTry:p?.mustTry,placeNotes:p?.notes};Object.entries(vals).forEach(([k,v])=>$(k).value=v??'');
  $('archivePlaceBtn').classList.toggle('hidden',!p||!!p.archivedAt);$('restorePlaceBtn').classList.toggle('hidden',!p||!p.archivedAt);$('deleteForeverBtn').classList.toggle('hidden',!p||!p.archivedAt||!isOwner());$('savePlaceBtn').classList.toggle('hidden',!!p?.archivedAt);$('placeDialog').showModal();
}
function editorPlace(){let lat=$('placeLat').value?+$('placeLat').value:null,lng=$('placeLng').value?+$('placeLng').value:null;const googleMapsUrl=clean($('placeGoogleUrl').value);if((lat==null||lng==null)&&googleMapsUrl){const m=googleMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);if(m){lat=+m[1];lng=+m[2];}}return {id:$('placeId').value||uid(),name:clean($('placeName').value),placeType:clean($('placeType').value),cuisine:clean($('placeCuisine').value),country:clean($('placeCountry').value),stateRegion:clean($('placeRegion').value),city:clean($('placeCity').value),suburb:clean($('placeSuburb').value),address:clean($('placeAddress').value),lat,lng,price:$('placePrice').value,phone:clean($('placePhone').value),website:clean($('placeWebsite').value),googleMapsUrl,bookingUrl:clean($('placeBookingUrl').value),mealTypes:arr($('placeMeals').value),greatFor:arr($('placeGreatFor').value),features:arr($('placeFeatures').value),dietary:arr($('placeDietary').value),tags:arr($('placeTags').value),mustTry:clean($('placeMustTry').value),notes:clean($('placeNotes').value)};}
async function savePlace(e){e.preventDefault();if(!canEdit())return;const p=editorPlace();if(!p.name)return;const old=places.find(x=>x.id===p.id);if(!old){const dup=duplicateOf(p);if(dup&&!confirm(`Possible duplicate: “${dup.name}”${dup.city?` in ${dup.city}`:''} already exists. Add this place anyway?`))return;}p.createdAt=old?.createdAt||nowISO();p.updatedAt=nowISO();p.archivedAt=old?.archivedAt||'';await makeCheckpoint(old?'Before edit':'Before add');if(CFG.mode==='local'){if(old)Object.assign(old,p);else places.unshift(p);state.places=places;saveLocalState();}else{if(old){await rest('places',{method:'PATCH',body:appPlaceToDb(p),filters:`?id=eq.${encodeURIComponent(p.id)}`});Object.assign(old,p);}else{const rows=await rest('places',{method:'POST',body:appPlaceToDb(p)});if(rows?.[0])p.id=rows[0].id;places.unshift(p);}}$('placeDialog').close();populateFilterOptions();render();toast(old?'Place updated':'Place added');}
async function archivePlace(id){if(!canEdit())return;const p=places.find(x=>x.id===id);if(!p)return;if(!confirm(`Move “${p.name}” to Archive? It can be restored later.`))return;await makeCheckpoint('Before archive');if(CFG.mode==='local'){p.archivedAt=nowISO();saveLocalState();}else{await rest('places',{method:'PATCH',body:{archived_at:nowISO()},filters:`?id=eq.${encodeURIComponent(id)}`});p.archivedAt=nowISO();}$('placeDialog').close();render();toast('Moved to Archive');}
async function restorePlace(id){if(!canEdit())return;const p=places.find(x=>x.id===id);if(!p)return;await makeCheckpoint('Before restore');if(CFG.mode==='local'){p.archivedAt='';saveLocalState();}else{await rest('places',{method:'PATCH',body:{archived_at:null},filters:`?id=eq.${encodeURIComponent(id)}`});p.archivedAt='';}$('placeDialog').close();render();toast('Restored');}
async function deleteForever(id){if(!isOwner())return toast('Only the Owner can permanently delete a venue.');const p=places.find(x=>x.id===id);if(!p?.archivedAt)return;if(!confirm(`Permanently delete “${p.name}” and its venue photos? This is Owner-only and cannot be undone except from a prior backup.`))return;await makeCheckpoint('Before permanent delete');const venuePhotos=photos.filter(x=>x.placeId===id);try{if(CFG.mode==='local'){for(const ph of venuePhotos){try{await localPhotoDelete(ph.id);}catch{}clearPhotoUrl(ph.id);}}else{const paths=venuePhotos.map(x=>x.storagePath).filter(Boolean);if(paths.length)await storageDelete(paths);}}catch(e){return toast(`Venue not deleted because photo cleanup failed: ${e.message}`);}if(CFG.mode==='local'){places=places.filter(x=>x.id!==id);photos=photos.filter(x=>x.placeId!==id);state.places=places;state.photos=photos;saveLocalState();}else{await rest('places',{method:'DELETE',filters:`?id=eq.${encodeURIComponent(id)}`,prefer:'return=minimal'});places=places.filter(x=>x.id!==id);photos=photos.filter(x=>x.placeId!==id);}$('placeDialog').close();render();toast('Permanently deleted');}

function normaliseImported(obj,source='Import'){
  const lc=Object.fromEntries(Object.entries(obj||{}).map(([k,v])=>[k.toLowerCase().replace(/[^a-z0-9]/g,''),v]));const name=clean(lc.title||lc.name||lc.placename||lc.location||obj?.properties?.name||obj?.properties?.title);if(!name)return null;
  let lat=lc.latitude||lc.lat||obj?.geometry?.coordinates?.[1],lng=lc.longitude||lc.lng||lc.lon||obj?.geometry?.coordinates?.[0];
  const url=clean(lc.googlemapsurl||lc.url||lc.link||lc.googleurl||obj?.properties?.url);if((!lat||!lng)&&url){const m=url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);if(m){lat=+m[1];lng=+m[2];}}
  return {id:uid(),name,placeType:clean(lc.type||lc.category),cuisine:clean(lc.cuisine),country:clean(lc.country),stateRegion:clean(lc.state||lc.region),city:clean(lc.city||lc.town),suburb:clean(lc.suburb||lc.neighborhood),address:clean(lc.address||lc.locationaddress),lat:lat?+lat:null,lng:lng?+lng:null,price:'',mealTypes:[],greatFor:[],features:[],dietary:[],tags:[source].filter(Boolean),mustTry:'',notes:clean(lc.note||lc.notes||lc.comment),website:clean(lc.website),googleMapsUrl:url,phone:clean(lc.phone),bookingUrl:'',createdAt:nowISO(),updatedAt:nowISO(),archivedAt:''};
}
async function parseImportFiles(files){const out=[];for(const f of files){const text=await f.text();if(f.name.toLowerCase().endsWith('.csv')){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(!lines.length)continue;const headers=splitCsvLine(lines[0]);for(const line of lines.slice(1)){const vals=splitCsvLine(line);const o={};headers.forEach((h,i)=>o[h]=vals[i]||'');const p=normaliseImported(o,f.name.replace(/\.[^.]+$/,''));if(p)out.push(p);}}else{try{const j=JSON.parse(text);const rows=j.type==='FeatureCollection'?j.features:Array.isArray(j)?j:(j.locations||j.places||j.features||[j]);for(const o of rows){const p=normaliseImported(o,f.name.replace(/\.[^.]+$/,''));if(p)out.push(p);}}catch{}}}return out;}
function duplicateOf(p,excludeId=''){const norm=v=>clean(v).toLowerCase().replace(/\/$/,'');const url=norm(p.googleMapsUrl);if(url){const hit=places.find(x=>x.id!==excludeId&&norm(x.googleMapsUrl)===url);if(hit)return hit;}const name=norm(p.name),city=norm(p.city);return places.find(x=>x.id!==excludeId&&norm(x.name)===name&&norm(x.city)===city);}
async function runImport(){if(!canEdit())return;const fresh=[];const seen=new Set();const key=p=>{const u=clean(p.googleMapsUrl).toLowerCase().replace(/\/$/,'');return u?`url:${u}`:`name:${clean(p.name).toLowerCase()}|city:${clean(p.city).toLowerCase()}`;};for(const p of importCandidates){const k=key(p);if(duplicateOf(p)||seen.has(k))continue;seen.add(k);fresh.push(p);}if(!fresh.length)return toast('No new places to import.');await makeCheckpoint('Before import');if(CFG.mode==='local'){places.push(...fresh);state.places=places;saveLocalState();}else{for(const p of fresh){const rows=await rest('places',{method:'POST',body:appPlaceToDb(p)});if(rows?.[0])p.id=rows[0].id;places.push(p);}}$('importDialog').close();populateFilterOptions();render();toast(`${fresh.length} place${fresh.length===1?'':'s'} imported; ${importCandidates.length-fresh.length} duplicate${importCandidates.length-fresh.length===1?'':'s'} skipped.`);}

function exportJson(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportBackup(){
  const payload={persFavouritesBackup:true,backupSchema:26,appVersion:CFG.version,deploymentId:CFG.deploymentId,exportedAt:nowISO(),settings:state.settings,places,photos,personal,visits,preferences,photoFiles:[]};
  if(CFG.mode==='local'){
    for(const ph of photos){try{const blob=await localPhotoGet(ph.id);if(blob)payload.photoFiles.push({id:ph.id,dataUrl:await fileToDataUrl(blob)});}catch{}}
  } else payload.productionPhotoNote='Photo binaries remain in this rollout\'s Supabase Storage bucket and are not embedded in this browser export.';
  exportJson(payload,`pers-favourites-v026-backup-${new Date().toISOString().slice(0,10)}.json`);
}
async function restoreBackup(file){
  if(!isOwner())return toast('Only the Owner can restore a backup.');let j;try{j=JSON.parse(await file.text())}catch{return toast('That file is not valid JSON.');}const payload=j?.data&&Array.isArray(j.data.places)?j.data:j;if(!j.persFavouritesBackup||!Array.isArray(payload?.places))return toast('This is not a recognised Pers Favourites backup.');if(!confirm(`Restore ${payload.places.length} places from this backup? Current local data will be checkpointed first.`))return;if(CFG.mode!=='local')return toast('Production restore is deliberately not performed from the browser. Use the rollout database/storage restore procedure in the Owner Manual.');checkpoint('Before backup restore');const migrated=normalizeLocalState({...payload,settings:payload.settings||j.settings||state.settings,preferences:state.preferences,history:state.history},`backup-schema-${j.backupSchema||'legacy'}`);state.settings=migrated.settings;state.places=migrated.places;state.photos=migrated.photos||[];state.personal=migrated.personal;state.visits=migrated.visits;state.preferences[currentUser.id]=j.preferences||payload.preferences?.[currentUser.id]||payload.preferences||defaultPreferences();state.migratedFrom=migrated.migratedFrom;state.migratedAt=migrated.migratedAt;for(const x of (j.photoFiles||payload.photoFiles||[])){try{await localPhotoPut(x.id,dataUrlToBlob(x.dataUrl));}catch{}}saveLocalState();await enterLocal();toast('Backup restored');
}
async function exportHistory(){if(CFG.mode==='local'){exportJson({appVersion:CFG.version,deploymentId:CFG.deploymentId,exportedAt:nowISO(),history:state.history},`pers-favourites-v026-history-${new Date().toISOString().slice(0,10)}.json`);return;}try{const rows=await rest('audit_snapshots',{filters:'&order=created_at.desc&limit=50'});exportJson({appVersion:CFG.version,deploymentId:CFG.deploymentId,exportedAt:nowISO(),history:rows},`pers-favourites-v026-history-${new Date().toISOString().slice(0,10)}.json`);}catch(e){toast(e.message);}}

async function requestLocation(){if(!navigator.geolocation)return toast('Location is not available in this browser.');navigator.geolocation.getCurrentPosition(pos=>{currentPosition={lat:pos.coords.latitude,lng:pos.coords.longitude};render();if(map)map.setView([currentPosition.lat,currentPosition.lng],13);},err=>toast(err.message||'Location permission was not granted.'),{enableHighAccuracy:true,timeout:10000});}
function resetFilters(){filters=defaultFilters();mapBoundsFilter=null;$('searchInput').value='';populateFilterOptions();render();}
function quickFilter(which){if(which==='near'){if(!currentPosition){requestLocation();}filters.distance=preferences.preferredDistance||'5';}if(which==='five')filters.rating=filters.rating==='5'?'':'5';if(which==='favourite')filters.status=filters.status==='favourite'?'':'favourite';if(which==='want')filters.status=filters.status==='want'?'':'want';if(which==='restaurant')filters.type=filters.type==='Restaurant'?'':'Restaurant';if(which==='winebar')filters.type=filters.type==='Wine Bar'?'':'Wine Bar';syncFilterControls();render();}
function openAuth(purpose='owner'){
  authPurpose=purpose;
  $('authTitle').textContent=purpose==='contributor'?'Contribute venue photos':'Owner / Admin sign in';
  $('authIntro').textContent=purpose==='contributor'?'Browsing never requires a login. To contribute a photo, enter your email and use the secure sign-in link we send you.':'Owner/Admin controls are protected. Sign in with the rollout account password. On supported phones, your password manager can use Face ID/biometrics to fill it.';
  $('loginPasswordWrap').classList.toggle('hidden',purpose==='contributor');$('loginBtn').classList.toggle('hidden',purpose==='contributor');$('forgotBtn').classList.toggle('hidden',purpose==='contributor');$('magicLinkBtn').classList.toggle('hidden',purpose!=='contributor');$('authMessage').textContent='';$('authScreen').showModal();
}

function openAccount(){
  const anon=isAnonymousViewer();
  $('accountSummary').innerHTML=anon?`<strong>Browsing as Viewer</strong><br><span class="muted">No login required</span>`:`<strong>${esc(currentUser?.displayName||currentUser?.email||'Local test')}</strong><br><span class="muted">${esc((currentUser?.role||'viewer').toUpperCase())}</span>${currentUser?.email?` · ${esc(currentUser.email)}`:''}`;
  $('ownerSigninBtn').classList.toggle('hidden',CFG.mode==='local'||!!session);
  $('contributorSigninBtn').classList.toggle('hidden',CFG.mode==='local'||!!session);
  $('editorSettings').classList.toggle('hidden',!canEdit());$('ownerSettings').classList.toggle('hidden',!isOwner());$('localRoleSettings').classList.toggle('hidden',CFG.mode!=='local');if(CFG.mode==='local')$('localRoleSelect').value=currentUser.role;
  $('settingAppName').value=state.settings.appName||'';$('settingOwnerName').value=state.settings.ownerDisplayName||'';$('settingHomeRegion').value=state.settings.homeRegion||'';$('settingAllowUserPhotos').checked=state.settings.allowUserPhotos!==false;$('rememberFilters').checked=!!preferences.rememberFilters;$('prefDistance').value=preferences.preferredDistance||'5';updatePendingPhotoBadge();$('signOutBtn').classList.toggle('hidden',CFG.mode!=='local'&&!session);$('accountDialog').showModal();
}
async function saveCollectionSettings(){if(!isOwner())return toast('Only the Owner can change collection identity.');const s={appName:clean($('settingAppName').value)||CFG.appName,ownerDisplayName:clean($('settingOwnerName').value),homeRegion:clean($('settingHomeRegion').value),allowUserPhotos:!!$('settingAllowUserPhotos').checked};await makeCheckpoint('Before collection settings change');if(CFG.mode==='local'){state.settings=s;saveLocalState();}else{await rest('app_settings',{method:'PATCH',body:{app_name:s.appName,owner_display_name:s.ownerDisplayName,home_region:s.homeRegion,allow_user_photos:s.allowUserPhotos},filters:'?id=eq.1'});state.settings=s;}setBranding();toast('Collection settings saved');}
function showArchive(){archiveMode=true;$('accountDialog').close();resetFilters();$('resultCount').scrollIntoView({behavior:'smooth'});toast('Showing Archive');}
async function signOut(){await persistPreferences();if(CFG.mode==='local'){localStorage.removeItem(LS_SESSION);location.reload();}else{try{await api('/auth/v1/logout',{method:'POST'});}catch{}localStorage.removeItem(LS_SESSION);location.reload();}}

function bindEvents(){
  $('startLocalBtn').onclick=()=>{localStorage.setItem(LS_SESSION,'local-started');enterLocal();};
  $('authClose').onclick=()=>$('authScreen').close();
  $('loginBtn').onclick=async()=>{try{$('authMessage').textContent='Signing in…';const next=await signIn($('loginEmail').value,$('loginPassword').value);session=next;localStorage.setItem(LS_SESSION,JSON.stringify(session));await hydrateSessionUser();await loadProductionData();if(authPurpose==='owner'&&!canEdit()){try{await api('/auth/v1/logout',{method:'POST'});}catch{}localStorage.removeItem(LS_SESSION);session=null;await loadPublicProductionData();$('authMessage').textContent='That account is not an Owner/Admin account for this rollout.';return;}showApp();if($('authScreen').open)$('authScreen').close();}catch(e){$('authMessage').textContent=e.message;}};
  $('magicLinkBtn').onclick=async()=>{try{const email=clean($('loginEmail').value);if(!email)throw new Error('Enter your email address.');await sendMagicLink(email);sessionStorage.setItem('pers-v026-pending-photo-place',pendingContributionPlaceId||activeDetailPlaceId||'');$('authMessage').textContent='Secure sign-in link sent. Open the email on this device, then return here to add your photo.';}catch(e){$('authMessage').textContent=e.message;}};
  $('forgotBtn').onclick=()=>{$('recoveryEmail').value=$('loginEmail').value;$('recoveryDialog').showModal();};$('recoveryClose').onclick=()=>$('recoveryDialog').close();
  $('sendRecoveryBtn').onclick=async()=>{try{await sendRecovery($('recoveryEmail').value);$('recoveryMessage').textContent='Recovery email sent. Use the secure link in that email.';}catch(e){$('recoveryMessage').textContent=e.message;}};
  $('saveNewPasswordBtn').onclick=async()=>{try{await updatePassword(session.access_token,$('newPassword').value);$('newPasswordMessage').textContent='Password updated. You can now sign in.';setTimeout(()=>{history.replaceState(null,'',location.pathname);location.reload();},800);}catch(e){$('newPasswordMessage').textContent=e.message;}};
  $('clearSearchBtn').onclick=()=>{$('searchInput').value='';render();};$('searchInput').oninput=render;
  $('quickActions').onclick=e=>{const b=e.target.closest('[data-quick]');if(b)quickFilter(b.dataset.quick);};
  $('listViewBtn').onclick=()=>setView('list');$('mapViewBtn').onclick=()=>setView('map');$('sortSelect').onchange=render;
  $('moreFiltersBtn').onclick=()=>{$('moreFiltersPanel').classList.toggle('hidden');};
  const fm={countryFilter:'country',regionFilter:'region',cityFilter:'city',typeFilter:'type',cuisineFilter:'cuisine',ratingFilter:'rating',distanceFilter:'distance',priceFilter:'price',mealFilter:'meal',greatForFilter:'greatFor',featureFilter:'feature',statusFilter:'status',dietaryFilter:'dietary',tagFilter:'tag'};
  Object.entries(fm).forEach(([id,k])=>$(id).onchange=()=>{filters[k]=$(id).value;if(k==='country'){filters.region='';filters.city='';populateFilterOptions();}if(k==='region'){filters.city='';populateFilterOptions();}render();});
  $('activeChips').onclick=e=>{const b=e.target.closest('[data-clear-filter]');if(b){filters[b.dataset.clearFilter]='';populateFilterOptions();render();}if(e.target.closest('[data-clear-area]')){mapBoundsFilter=null;render();}};
  $('resetFiltersBtn').onclick=()=>{archiveMode=false;resetFilters();};$('searchAreaBtn').onclick=()=>{mapBoundsFilter=map.getBounds();$('searchAreaBtn').classList.add('hidden');render();};
  $('addPlaceBtn').onclick=()=>openPlaceEditor();$('placeForm').onsubmit=savePlace;$('archivePlaceBtn').onclick=()=>archivePlace($('placeId').value);$('restorePlaceBtn').onclick=()=>restorePlace($('placeId').value);$('deleteForeverBtn').onclick=()=>deleteForever($('placeId').value);
  $('listPanel').onclick=e=>{const open=e.target.closest('[data-open]');const edit=e.target.closest('[data-edit]');if(open)openDetail(open.dataset.open);if(edit)openPlaceEditor(edit.dataset.edit);};
  $('detailClose').onclick=()=>{$('detailDialog').close();activeDetailPlaceId='';};$('detailBody').onclick=e=>{const r=e.target.closest('[data-rate]'),s=e.target.closest('[data-save-personal]'),v=e.target.closest('[data-log-visit]'),sh=e.target.closest('[data-share]'),ed=e.target.closest('[data-edit]'),add=e.target.closest('[data-add-photo]'),po=e.target.closest('[data-photo-open]'),pa=e.target.closest('[data-photo-approve]'),ph=e.target.closest('[data-photo-hide]'),pc=e.target.closest('[data-photo-cover]'),pca=e.target.closest('[data-photo-caption]'),pe=e.target.closest('[data-photo-earlier]'),pl=e.target.closest('[data-photo-later]'),pd=e.target.closest('[data-photo-delete]');if(r)setRating(r.closest('[data-stars]').dataset.stars,+r.dataset.rate);if(s)savePersonalFromDetail(s.dataset.savePersonal);if(v)logVisit(v.dataset.logVisit);if(sh)sharePlace(sh.dataset.share);if(add){activeDetailPlaceId=add.dataset.addPhoto;if(!canEdit()&&state?.settings?.allowUserPhotos===false){toast('The Owner has turned off user photo contributions.');}else if(isAnonymousViewer()){pendingContributionPlaceId=activeDetailPlaceId;openAuth('contributor');}else $('photoInput').click();}if(po)openPhotoViewer(po.dataset.photoOpen);if(pa)setPhotoState(pa.dataset.photoApprove,'approved');if(ph)setPhotoState(ph.dataset.photoHide,'hidden');if(pc)setCoverPhoto(pc.dataset.photoCover);if(pca)editPhotoCaption(pca.dataset.photoCaption);if(pe)movePhoto(pe.dataset.photoEarlier,-1);if(pl)movePhoto(pl.dataset.photoLater,1);if(pd)deletePhoto(pd.dataset.photoDelete);if(ed){$('detailDialog').close();openPlaceEditor(ed.dataset.edit);}};
  $('importBtn').onclick=()=>$('importDialog').showModal();$('importClose').onclick=()=>$('importDialog').close();$('importFiles').onchange=async()=>{importCandidates=await parseImportFiles([...$('importFiles').files]);const dup=importCandidates.filter(duplicateOf).length;$('importPreview').innerHTML=`<p><strong>${importCandidates.length}</strong> usable place records found; <strong>${dup}</strong> appear to be duplicates.</p>`+importCandidates.slice(0,50).map(p=>`<div class="import-row">${esc(p.name)}${p.city?' · '+esc(p.city):''}</div>`).join('');$('runImportBtn').disabled=!importCandidates.length;};$('runImportBtn').onclick=runImport;
  $('accountBtn').onclick=openAccount;$('accountClose').onclick=()=>$('accountDialog').close();$('ownerSigninBtn').onclick=()=>{$('accountDialog').close();openAuth('owner');};$('contributorSigninBtn').onclick=()=>{$('accountDialog').close();openAuth('contributor');};$('saveSettingsBtn').onclick=saveCollectionSettings;$('managePhotosBtn').onclick=()=>{$('accountDialog').close();openPhotoModeration();};$('showArchiveBtn').onclick=showArchive;$('exportBackupBtn').onclick=exportBackup;$('restoreBackupBtn').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=()=>restoreBackup($('restoreFile').files[0]);$('exportHistoryBtn').onclick=exportHistory;$('signOutBtn').onclick=signOut;
  $('photoInput').onchange=async()=>{const fs=[...$('photoInput').files];$('photoInput').value='';if(activeDetailPlaceId)await addPhotos(activeDetailPlaceId,fs);};$('photoViewerClose').onclick=()=>$('photoViewerDialog').close();$('photoModerationClose').onclick=()=>$('photoModerationDialog').close();$('photoModerationFilter').onchange=renderPhotoModeration;$('photoModerationList').onclick=e=>{const po=e.target.closest('[data-photo-open]'),pa=e.target.closest('[data-photo-approve]'),ph=e.target.closest('[data-photo-hide]'),pc=e.target.closest('[data-photo-cover]'),pca=e.target.closest('[data-photo-caption]'),pe=e.target.closest('[data-photo-earlier]'),pl=e.target.closest('[data-photo-later]'),pd=e.target.closest('[data-photo-delete]');if(po)openPhotoViewer(po.dataset.photoOpen);if(pa)setPhotoState(pa.dataset.photoApprove,'approved');if(ph)setPhotoState(ph.dataset.photoHide,'hidden');if(pc)setCoverPhoto(pc.dataset.photoCover);if(pca)editPhotoCaption(pca.dataset.photoCaption);if(pe)movePhoto(pe.dataset.photoEarlier,-1);if(pl)movePhoto(pl.dataset.photoLater,1);if(pd)deletePhoto(pd.dataset.photoDelete);};
  $('prefDistance').onchange=()=>{preferences.preferredDistance=$('prefDistance').value;persistPreferences();};$('rememberFilters').onchange=()=>{preferences.rememberFilters=$('rememberFilters').checked;persistPreferences();};$('localRoleSelect').onchange=async()=>{const role=$('localRoleSelect').value;const u=state.users.find(x=>x.role===role);if(u){const outgoingUserId=currentUser?.id;await persistPreferences(outgoingUserId);state.activeUserId=u.id;saveLocalState();$('accountDialog').close();await enterLocal();toast(`Local test role: ${role}`);}};
}

window.PERS_TEST={
  version:CFG.version, openPlace:openDetail,
  getState:()=>({currentUser,places,photos,personal,visits,preferences,filters,filteredPlaces}),
  addSample:()=>{if(CFG.mode!=='local')return;const s=[
    {name:'Sample Harbour Wine Bar',placeType:'Wine Bar',cuisine:'Modern Australian',country:'Australia',stateRegion:'Victoria',city:'Melbourne',suburb:'Williamstown',address:'Nelson Place, Williamstown VIC',lat:-37.8637,lng:144.8949,price:'$$$',mealTypes:['Drinks','Dinner'],greatFor:['Views','Visitors'],features:['Waterfront','Outdoor Seating'],dietary:['Vegetarian'],tags:['Great Wine','Local Favourite'],mustTry:'Local Chardonnay',notes:'Sample data for v026 testing.',website:'',googleMapsUrl:'https://maps.google.com/?q=-37.8637,144.8949',phone:'',bookingUrl:''},
    {name:'Sample Old Town Tapas',placeType:'Restaurant',cuisine:'Spanish',country:'Spain',stateRegion:'Balearic Islands',city:'Palma',suburb:'Old Town',address:'Palma, Mallorca',lat:39.5696,lng:2.6502,price:'$$',mealTypes:['Lunch','Dinner'],greatFor:['Casual','Visitors'],features:['Outdoor Seating'],dietary:['Vegetarian'],tags:['Old Town'],mustTry:'Seafood paella',notes:'Sample data for v026 filter testing.',website:'',googleMapsUrl:'https://maps.google.com/?q=39.5696,2.6502',phone:'',bookingUrl:''}
  ];checkpoint('Before sample data');for(const p of s){p.id=uid();p.createdAt=p.updatedAt=nowISO();p.archivedAt='';places.push(p);}state.places=places;saveLocalState();populateFilterOptions();render();return s.length;}
};

boot();
