import fs from 'node:fs';
import path from 'node:path';

const VERSION='0.27.25';
const root=process.cwd();
const failures=[];
const passes=[];
const assert=(ok,msg)=>{(ok?passes:failures).push(msg);};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const required=[
  'index.html','app.js','styles.css','config.js','config.example.js','branding.js',
  'manifest.webmanifest','sw.js','version.json','README.md','geo-fallback.js',
  'privacy.html','terms.html','cloudflare/places-search-worker.js',
  'docs/OWNER_GUIDE.md','docs/SYSTEM_ADMINISTRATOR_GUIDE.md','docs/USER_GUIDE.md',
  'icons/icon-192.png','icons/icon-512.png'
];
for(const p of required)assert(fs.existsSync(path.join(root,p)),`required file: ${p}`);

const app=read('app.js'), index=read('index.html'), worker=read('cloudflare/places-search-worker.js');
const styles=read('styles.css'), sw=read('sw.js'), config=read('config.js'), configExample=read('config.example.js');
const version=JSON.parse(read('version.json'));

assert(version.version===VERSION,'version.json matches release');
assert(app.includes(`version:'${VERSION}'`),'app.js default version matches release');
assert(config.includes(`version: "${VERSION}"`),'config.js version matches release');
assert(configExample.includes(`version: "${VERSION}"`),'config.example.js version matches release');
assert(sw.includes(`pers-favourites-${VERSION}-shell`),'service worker cache version matches release');
assert(index.includes(`id="versionLabel">${VERSION}</span>`),'visible version label matches release');
assert(index.includes('id="currentAppVersion">'+VERSION+'</strong>'),'update panel version matches release');
for(const asset of ['config.js','branding.js','geo-fallback.js','app.js','styles.css']){
  assert(index.includes(`${asset}?v=${VERSION}`),`HTML version-pins ${asset}`);
  assert(sw.includes(`${asset}?v=${VERSION}`),`offline shell includes version-pinned ${asset}`);
}
assert(sw.includes("cache:'reload'"),'shell install revalidates HTTP cache');

const ids=[...index.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const dupIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert(dupIds.length===0,'no duplicate static HTML ids');

const staticRefs=[...app.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
const dynamicIds=new Set(['detailPrivateNote']);
const missingRefs=[...new Set(staticRefs.filter(id=>!ids.includes(id)&&!dynamicIds.has(id)))];
assert(missingRefs.length===0,'all static DOM id references exist');

assert(index.includes('>My Settings</button>'),'My Settings role label present');
assert(index.includes('>Owner <span'),'Owner role label present');
assert(index.includes('>System Administrator <span'),'System Administrator role label present');
assert(index.includes('Costs &amp; Payments'),'Owner Costs & Payments present');
for(const id of ['ownerGoogleSpendCap','ownerTripadvisorSpendCap','ownerCloudflareSpendCap','ownerOpenAiSpendCap']){
  assert(index.includes(`id="${id}"`),`Owner cost control present: ${id}`);
}
assert(index.includes('id="sysadminTripadvisorOwnerApproval"'),'System Administrator can see Owner TripAdvisor approval record');

assert(app.includes('externalGoogleResultsPanel'),'separate Google results section present');
assert(app.includes('externalTripadvisorResultsPanel'),'separate TripAdvisor results section present');
assert(app.includes("provider:'Google Places'"),'Google provider remains internally identifiable');
assert(app.includes('googleMapsAttributionHtml'),'Google Maps attribution helper present');
assert(styles.includes('.google-maps-attribution'),'Google Maps attribution styling present');
assert(index.includes('./terms.html')&&index.includes('./privacy.html'),'public legal links present in app');
assert(sw.includes('./terms.html')&&sw.includes('./privacy.html'),'legal pages included in offline shell');
assert(read('terms.html').includes('Google Maps Platform Terms of Service'),'Terms incorporates Google Maps Platform terms');
assert(read('privacy.html').includes('Google Privacy Policy'),'Privacy incorporates Google Privacy Policy');

assert(!app.includes('LS_GOOGLE_PHOTO_REFS'),'obsolete Google photo-name cache removed');
assert(!app.includes('rememberGooglePhotoRef'),'persistent Google photo-name writer removed');
assert(app.includes('clearLegacyGooglePhotoStorage'),'legacy Google photo-name cache cleanup present');
assert(app.includes("googlePhotoRef:''"),'saved place model clears Google photo resource name');
assert(app.includes('photoGoogleMapsUri'),'live Google photo source link carried transiently');
assert(worker.includes("photoGoogleMapsUri: photo.googleMapsUri"),'Worker returns individual Google photo source link');
assert(worker.includes("photoFlagContentUri: photo.flagContentUri"),'Worker returns Google photo reporting link');
assert(app.includes('applyGooglePersistenceGuard'),'Google provider persistence guard present');
assert(app.includes('googleMapsUrlFromPlaceId'),'Google Maps link is constructed from permitted Place ID');
assert(app.includes('liveExternalByPlace'),'live provider data kept in transient session map');

assert(worker.includes("GOOGLE_PLACES_MODE"),'Google mode setting present');
assert(worker.includes('GOOGLE_PLACES_PRODUCTION_MINUTE_LIMIT'),'Google production minute safeguard present');
assert(worker.includes('GOOGLE_PLACES_PRODUCTION_DAILY_LIMIT'),'Google production daily safeguard present');
assert(worker.includes("Google Places calls are blocked because USAGE_DB"),'Google D1 safeguard required');

for(const key of [
  'TRIPADVISOR_API_KEY','TRIPADVISOR_ENABLED','TRIPADVISOR_FREE_ALLOWANCE',
  'TRIPADVISOR_ALLOWANCE_PERIOD','TRIPADVISOR_WARNING_PERCENT','TRIPADVISOR_CUTOFF_PERCENT',
  'TRIPADVISOR_OWNER_PAID_APPROVED','TRIPADVISOR_ALLOW_PAID'
])assert(worker.includes(key),`TripAdvisor setting present: ${key}`);
assert(worker.includes("TRIPADVISOR_FREE_ALLOWANCE',0"),'TripAdvisor allowance has no hidden free-call default');
assert(app.includes('tripadvisorSearchChain'),'TripAdvisor sustained request queue present');
assert(app.includes('resolveTripadvisorPhoto'),'TripAdvisor last-resort photo fallback present');
assert(app.indexOf("const google=place.provider===")>=0&&app.indexOf("const google=place.provider===")<app.indexOf('const ta=await resolveTripadvisorPhoto(place)'),'photo fallback order is Google before TripAdvisor');

for(const p of ['docs/OWNER_GUIDE.md','docs/SYSTEM_ADMINISTRATOR_GUIDE.md','docs/USER_GUIDE.md']){
  const d=read(p);assert(d.includes('0.27.25'),`${p} updated for v0.27.25`);
}
assert(read('docs/SYSTEM_ADMINISTRATOR_GUIDE.md').includes('Documentation Change Log'),'System Administrator Guide contains documentation change log');
const ownerGuide=read('docs/OWNER_GUIDE.md');
const adminGuide=read('docs/SYSTEM_ADMINISTRATOR_GUIDE.md');
const userGuide=read('docs/USER_GUIDE.md');
for(const section of ['Collection settings','Adding and editing a venue','Venue photos','Managed lists','Archive and permanent deletion','Import and backup','Costs & Payments','Owner handover']){
  assert(ownerGuide.includes(section),`Owner Guide section present: ${section}`);
}
for(const section of ['Role model and responsibilities','Owner functions the System Administrator must understand','Cloudflare Worker','Google Places connection','TripAdvisor Terra connection','Costs & Payments architecture','Authentication and handover','Deployment procedure','Troubleshooting']){
  assert(adminGuide.includes(section),`System Administrator Guide section present: ${section}`);
}
for(const section of ['Add Pers Favourites to an iPhone Home Screen','Add Pers Favourites to an Android Home Screen','Browse the collection','Set your location','Filters','External results','Photos','My Settings','App updates']){
  assert(userGuide.includes(section),`User Guide section present: ${section}`);
}

function walk(dir){
  const out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.name==='.git')continue;
    const full=path.join(dir,ent.name);
    if(ent.isDirectory())out.push(...walk(full));else out.push(full);
  }
  return out;
}
const sourceFiles=walk(root).filter(p=>/\.(js|mjs|html|md|json|css|yml|yaml)$/.test(p)&&path.relative(root,p)!=='qa/release-check.mjs');
const supersededHits=[];
for(const file of sourceFiles){
  const text=fs.readFileSync(file,'utf8');
  if(/supabase/i.test(text))supersededHits.push(path.relative(root,file));
}
assert(supersededHits.length===0,'superseded backend references removed from current release');

const secretPatterns=[/AIza[0-9A-Za-z_-]{20,}/, /sk-[A-Za-z0-9_-]{20,}/];
const secretHits=[];
for(const file of sourceFiles){
  const text=fs.readFileSync(file,'utf8');
  if(secretPatterns.some(re=>re.test(text)))secretHits.push(path.relative(root,file));
}
assert(secretHits.length===0,'no obvious API secrets committed');

const report={version:VERSION,passed:passes.length,failed:failures.length,passes,failures,duplicateIds:dupIds,missingStaticIds:missingRefs,supersededHits,secretHits};
fs.writeFileSync(path.join(root,'qa-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
