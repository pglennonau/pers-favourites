const enc = new TextEncoder();
const JSON_FIELDS = {
  app_list_options: new Set(['options']),
  places: new Set(['meal_types','great_for','features','dietary','tags']),
  user_preferences: new Set(['preferences']),
  audit_snapshots: new Set(['snapshot']),
  import_transactions: new Set(['transaction_json'])
};
const BOOL_FIELDS = {
  app_settings: new Set(['allow_user_photos','ask_pers_enabled']),
  venue_photos: new Set(['is_cover']),
  personal_place_data: new Set(['favourite','want_to_visit','visited'])
};
const TABLE_COLUMNS = {
  app_settings:['id','deployment_id','app_name','owner_display_name','home_region','allow_user_photos','ask_pers_enabled','ask_pers_daily_limit','updated_at'],
  app_list_options:['id','options','updated_by','updated_at'],
  profiles:['id','email','display_name','role','created_at','updated_at'],
  places:['id','name','place_type','cuisine','country','state_region','city','suburb','address','lat','lng','price','meal_types','great_for','features','dietary','tags','must_try','notes','website','google_maps_url','phone','booking_url','source_name','source_id','source_url','source_checked_at','archived_at','created_at','updated_at'],
  venue_photos:['id','place_id','uploaded_by','uploader_display_name','uploader_role','caption','storage_path','mime_type','status','is_cover','sort_order','moderated_by','moderated_at','created_at','updated_at'],
  personal_place_data:['user_id','place_id','rating','favourite','want_to_visit','visited','private_note','last_visited','would_go_again'],
  visits:['id','place_id','user_id','visited_at','rating','comment'],
  user_preferences:['user_id','preferences','updated_at'],
  audit_snapshots:['id','created_by','reason','snapshot','created_at'],
  import_transactions:['id','created_by','transaction_json','created_at','undone_at']
};

export function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
export function err(message,status=400){return json({error:message},status)}
export function uid(){return crypto.randomUUID()}
export function now(){return new Date().toISOString()}
export function clean(v){return v==null?'':String(v).trim()}
export function parseJson(s,fallback){try{return s==null?fallback:JSON.parse(s)}catch{return fallback}}
export function decodeRow(table,row){if(!row)return row;const out={...row};for(const k of JSON_FIELDS[table]||[]){if(k in out)out[k]=parseJson(out[k],k==='options'||k==='preferences'||k==='snapshot'||k==='transaction_json'?{}:[])}for(const k of BOOL_FIELDS[table]||[]){if(k in out)out[k]=!!out[k]}return out}
export function encodeBody(table,body={}){const cols=new Set(TABLE_COLUMNS[table]||[]),out={};for(const [k,v] of Object.entries(body)){if(!cols.has(k))continue;if(JSON_FIELDS[table]?.has(k))out[k]=JSON.stringify(v??(k==='options'||k==='preferences'||k==='snapshot'||k==='transaction_json'?{}:[]));else if(BOOL_FIELDS[table]?.has(k))out[k]=v?1:0;else out[k]=v;}return out}
export async function rows(env,sql,bind=[]){const r=await env.PERS_DB.prepare(sql).bind(...bind).all();return r.results||[]}
export async function first(env,sql,bind=[]){return await env.PERS_DB.prepare(sql).bind(...bind).first()}

function b64urlToBytes(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function parseJwt(jwt){const [h,p,s]=String(jwt||'').split('.');if(!h||!p||!s)throw new Error('Invalid Access token');return {header:JSON.parse(new TextDecoder().decode(b64urlToBytes(h))),payload:JSON.parse(new TextDecoder().decode(b64urlToBytes(p))),signed:`${h}.${p}`,sig:b64urlToBytes(s)}}
let jwksCache={at:0,keys:[]};
async function getJwks(env){if(Date.now()-jwksCache.at<3600000&&jwksCache.keys.length)return jwksCache.keys;const domain=clean(env.CF_ACCESS_TEAM_DOMAIN).replace(/\/$/,'');if(!domain)throw new Error('CF_ACCESS_TEAM_DOMAIN is not configured');const r=await fetch(`${domain}/cdn-cgi/access/certs`);if(!r.ok)throw new Error('Could not load Cloudflare Access signing keys');const d=await r.json();jwksCache={at:Date.now(),keys:d.keys||[]};return jwksCache.keys}
export async function accessIdentity(request,env,{audience='admin'}={}){
  const u=new URL(request.url);
  if((u.hostname==='127.0.0.1'||u.hostname==='localhost')&&request.headers.get('x-pers-dev-email'))return {email:clean(request.headers.get('x-pers-dev-email')).toLowerCase(),verified:true,dev:true};
  const jwt=request.headers.get('cf-access-jwt-assertion')||((request.headers.get('cookie')||'').match(/(?:^|;\s*)CF_Authorization=([^;]+)/)||[])[1];
  if(!jwt)throw Object.assign(new Error('Protected access required'),{status:401});
  const j=parseJwt(jwt),aud=(audience==='contributor'?env.CF_ACCESS_CONTRIB_AUD:env.CF_ACCESS_ADMIN_AUD)||env.CF_ACCESS_AUD,team=clean(env.CF_ACCESS_TEAM_DOMAIN).replace(/\/$/,'');
  if(!aud||!team)throw Object.assign(new Error('Cloudflare Access verification is not configured'),{status:500});
  const nowS=Math.floor(Date.now()/1000);if(j.payload.exp&&j.payload.exp<nowS)throw Object.assign(new Error('Access session expired'),{status:401});
  const audiences=Array.isArray(j.payload.aud)?j.payload.aud:[j.payload.aud];if(!audiences.includes(aud))throw Object.assign(new Error('Access token audience mismatch'),{status:403});
  if(clean(j.payload.iss).replace(/\/$/,'')!==team)throw Object.assign(new Error('Access token issuer mismatch'),{status:403});
  const keys=await getJwks(env),jwk=keys.find(k=>k.kid===j.header.kid);if(!jwk)throw Object.assign(new Error('Access signing key not found'),{status:401});
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const ok=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,j.sig,enc.encode(j.signed));if(!ok)throw Object.assign(new Error('Access token signature is invalid'),{status:401});
  const email=clean(j.payload.email).toLowerCase();if(!email)throw Object.assign(new Error('Access identity has no email address'),{status:403});return {email,sub:j.payload.sub||'',verified:true};
}
export async function profileFor(env,email,{createOwner=true,contributorFallback=false}={}){
  email=clean(email).toLowerCase();let p=await first(env,'SELECT * FROM profiles WHERE lower(email)=?', [email]);
  const owner=clean(env.OWNER_EMAIL).toLowerCase();if(!p&&createOwner&&owner&&email===owner){await env.PERS_DB.prepare("INSERT OR IGNORE INTO profiles(id,email,display_name,role) VALUES(?,?,?,'owner')").bind(email,email,email.split('@')[0]).run();p=await first(env,'SELECT * FROM profiles WHERE lower(email)=?',[email]);}
  if(!p&&contributorFallback)return {id:email,email,display_name:email.split('@')[0],role:'contributor'};return p;
}
export async function requireRole(request,env,roles,{contributorFallback=false}={}){const ident=await accessIdentity(request,env,{audience:contributorFallback?'contributor':'admin'});const p=await profileFor(env,ident.email,{contributorFallback});if(!p||!roles.includes(p.role))throw Object.assign(new Error('This account does not have permission for this action.'),{status:403});return {...p,id:p.id||p.email,email:p.email||ident.email,displayName:p.display_name||p.displayName||p.email,role:p.role}}

function parseFilters(raw=''){const s=String(raw||'').replace(/^[?&]/,'');return new URLSearchParams(s)}
function whereFrom(table,params,forcedUser=''){
  const cols=new Set(TABLE_COLUMNS[table]||[]),where=[],bind=[];
  for(const [k,v] of params.entries()){
    if(['select','order','limit','on_conflict'].includes(k)||!cols.has(k))continue;
    if(forcedUser&&k==='user_id')continue;
    if(v.startsWith('eq.')){where.push(`${k} = ?`);bind.push(v.slice(3)==='true'?1:v.slice(3)==='false'?0:v.slice(3));}
  }
  if(forcedUser&&cols.has('user_id')){where.push('user_id = ?');bind.push(forcedUser)}
  return {sql:where.length?` WHERE ${where.join(' AND ')}`:'',bind};
}
function orderLimit(params,table){let s='';const order=params.get('order');if(order){const bits=order.split(',').map(x=>x.split('.')).filter(([c])=>(TABLE_COLUMNS[table]||[]).includes(c));if(bits.length)s+=' ORDER BY '+bits.map(([c,d])=>`${c} ${d==='desc'?'DESC':'ASC'}`).join(', ');}const lim=Math.min(200,+params.get('limit')||0);if(lim)s+=` LIMIT ${lim}`;return s}

export async function genericDb(env,{table,method='GET',filters='',body,actor}){
  if(!TABLE_COLUMNS[table])throw Object.assign(new Error('Unsupported data resource'),{status:400});
  const role=actor?.role||'viewer',userKey=actor?.id||actor?.email||'';method=String(method||'GET').toUpperCase();
  const userScoped=new Set(['personal_place_data','visits','user_preferences']);
  if(method!=='GET'&&!['owner','admin'].includes(role)&&!(role==='contributor'&&table==='venue_photos'))throw Object.assign(new Error('Write access requires Owner/Admin.'),{status:403});
  const params=parseFilters(filters),forcedUser=userScoped.has(table)?userKey:'';
  if(method==='GET'){
    let extra='';if(table==='personal_place_data'||table==='visits'||table==='user_preferences')extra=forcedUser?'':'';
    const w=whereFrom(table,params,forcedUser);const rs=await rows(env,`SELECT * FROM ${table}${w.sql}${orderLimit(params,table)}`,w.bind);return rs.map(r=>decodeRow(table,r));
  }
  if(method==='POST'){
    let d=encodeBody(table,body||{});if(forcedUser)d.user_id=forcedUser;
    if(table==='places'&&!d.id)d.id=uid();if(table==='visits'&&!d.id)d.id=uid();if(table==='venue_photos'&&!d.id)d.id=uid();if(table==='audit_snapshots'&&!d.id)d.id=uid();
    if(table==='personal_place_data'){
      const cols=Object.keys(d);const updates=cols.filter(c=>!['user_id','place_id'].includes(c)).map(c=>`${c}=excluded.${c}`).join(',');await env.PERS_DB.prepare(`INSERT INTO personal_place_data(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')}) ON CONFLICT(user_id,place_id) DO UPDATE SET ${updates}`).bind(...cols.map(c=>d[c])).run();return [decodeRow(table,await first(env,'SELECT * FROM personal_place_data WHERE user_id=? AND place_id=?',[forcedUser,d.place_id]))];
    }
    if(table==='user_preferences'){
      d.user_id=forcedUser;const cols=Object.keys(d);await env.PERS_DB.prepare(`INSERT INTO user_preferences(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')}) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences,updated_at=CURRENT_TIMESTAMP`).bind(...cols.map(c=>d[c])).run();return [decodeRow(table,await first(env,'SELECT * FROM user_preferences WHERE user_id=?',[forcedUser]))];
    }
    if(table==='app_list_options')d.id=1;if(table==='app_settings')d.id=1;
    const cols=Object.keys(d);await env.PERS_DB.prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')})`).bind(...cols.map(c=>d[c])).run();
    if(d.id!=null)return [decodeRow(table,await first(env,`SELECT * FROM ${table} WHERE id=?`,[d.id]))];return [];
  }
  if(method==='PATCH'){
    const d=encodeBody(table,body||{});delete d.id;if(!Object.keys(d).length)return [];
    if(forcedUser)d.user_id=forcedUser;const set=Object.keys(d).filter(k=>k!=='user_id').map(k=>`${k}=?`);const vals=Object.keys(d).filter(k=>k!=='user_id').map(k=>d[k]);if(TABLE_COLUMNS[table].includes('updated_at')&&!Object.prototype.hasOwnProperty.call(d,'updated_at')){set.push('updated_at=?');vals.push(now())}
    const w=whereFrom(table,params,forcedUser);await env.PERS_DB.prepare(`UPDATE ${table} SET ${set.join(',')}${w.sql}`).bind(...vals,...w.bind).run();const rs=await rows(env,`SELECT * FROM ${table}${w.sql}${orderLimit(params,table)}`,w.bind);return rs.map(r=>decodeRow(table,r));
  }
  if(method==='DELETE'){
    if(table==='places'&&role!=='owner')throw Object.assign(new Error('Only the Owner can permanently delete places.'),{status:403});const w=whereFrom(table,params,forcedUser);if(!w.sql)throw Object.assign(new Error('Delete requires a filter'),{status:400});await env.PERS_DB.prepare(`DELETE FROM ${table}${w.sql}`).bind(...w.bind).run();return [];
  }
  throw Object.assign(new Error('Unsupported method'),{status:405});
}

export async function publicRest(env,{table,filters=''}){
  const params=parseFilters(filters);
  if(table==='app_settings')return (await rows(env,'SELECT id,deployment_id,app_name,owner_display_name,home_region,allow_user_photos,ask_pers_enabled,ask_pers_daily_limit,updated_at FROM app_settings WHERE id=1')).map(r=>decodeRow(table,r));
  if(table==='app_list_options')return (await rows(env,'SELECT * FROM app_list_options WHERE id=1')).map(r=>decodeRow(table,r));
  if(table==='places')return (await rows(env,'SELECT * FROM places WHERE archived_at IS NULL ORDER BY name ASC')).map(r=>decodeRow(table,r));
  if(table==='venue_photos')return (await rows(env,"SELECT * FROM venue_photos WHERE status='approved' ORDER BY sort_order ASC,created_at ASC")).map(r=>decodeRow(table,r));
  throw Object.assign(new Error('Unsupported public resource'),{status:400});
}

export async function ensureSeed(env){
  const id=clean(env.DEPLOYMENT_ID)||'pers-favourites';const settings=await first(env,'SELECT id FROM app_settings WHERE id=1');if(!settings)await env.PERS_DB.prepare('INSERT INTO app_settings(id,deployment_id,app_name,owner_display_name,home_region,allow_user_photos,ask_pers_enabled,ask_pers_daily_limit) VALUES(1,?,?,?,?,1,0,50)').bind(id,'Pers Favourites','Owner','').run();
  const list=await first(env,'SELECT id FROM app_list_options WHERE id=1');if(!list)await env.PERS_DB.prepare("INSERT INTO app_list_options(id,options) VALUES(1,'{}')").run();
}

export async function hashText(text){const buf=await crypto.subtle.digest('SHA-256',enc.encode(String(text)));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
