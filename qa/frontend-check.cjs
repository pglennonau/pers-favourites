/* Run with jsdom installed in the test environment. No live services are called. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=process.env.PERS_TEST_ROOT||process.cwd();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{url:'https://example.test/pers-favourites/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
const run=code=>require('node:vm').runInContext(code,dom.getInternalVMContext());
w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
w.URL.createObjectURL=()=> 'blob:https://example.test/qa';w.URL.revokeObjectURL=()=>{};
w.HTMLElement.prototype.scrollIntoView=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
let photoCalls=0,searchCalls=0,failPhoto=false,geoCalls=0;
const googleRow={id:'google-don',name:'Cafeteria Don Pepe',lat:37.88,lng:-4.77,city:'Córdoba',country:'Spain',photoRef:'places/google-don/photos/test',photoAttribution:[{displayName:'Test Photographer',uri:'https://example.test/author'}],photoGoogleMapsUri:'https://example.test/source',photoFlagContentUri:'https://example.test/report'};
w.fetch=async(url,opts)=>{
 if(String(url).includes('/photo')){photoCalls++;return {ok:!failPhoto,json:async()=>failPhoto?{error:'Google Places demo minute limit reached.'}:{photoUri:'https://example.test/photo.jpg'}};}
 if(opts?.method==='POST'){searchCalls++;return {ok:true,json:async()=>({places:[googleRow]})};}
 return {ok:true,json:async()=>({version:'0.27.25'})};
};
Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:success=>{geoCalls++;success({coords:{latitude:37.88,longitude:-4.77,accuracy:10}});}}});
const tick=()=>new Promise(r=>setTimeout(r,15));
const ev=id=>w.document.getElementById(id).dispatchEvent(new w.Event('change',{bubbles:true}));
const read=run;
const passes=[];function check(label,fn){try{fn();passes.push(label);}catch(e){e.message=label+': '+e.message;throw e;}}
(async()=>{
 for(const file of ['config.js','geo-fallback.js','branding.js','app.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
 w.document.getElementById('startLocalBtn').click();await tick();
 read(`window.PERS_TEST.seedCatalogue([
 {id:'b',name:'Beta',lat:37.90,lng:-4.77,price:'$',persRating:5,createdAt:'2026-03-01',placeType:'Cafe',country:'Spain',stateRegion:'Andalusia',city:'Córdoba'},
 {id:'c',name:'Charlie',lat:37.881,lng:-4.77,price:'$$',persRating:3,createdAt:'2026-01-01',placeType:'Bar',country:'Spain',stateRegion:'Andalusia',city:'Granada'},
 {id:'a',name:'Alpha',lat:null,lng:null,price:'$$$',persRating:4,createdAt:'2026-02-01',placeType:'Cafe',country:'Australia',stateRegion:'Victoria',city:'Melbourne'}
 ]);personal={[personalKey('a')]:{lastVisited:'2026-03-01'},[personalKey('b')]:{lastVisited:'2026-01-01'},[personalKey('c')]:{lastVisited:'2026-02-01'}};
 state.users.push({id:'qa-viewer',role:'viewer'});userRatings=[{placeId:'a',userId:'qa-viewer',rating:5},{placeId:'b',userId:'qa-viewer',rating:3},{placeId:'c',userId:'qa-viewer',rating:4}];`);
 for(const [sort,expected] of Object.entries({name:['a','b','c'],persRating:['b','a','c'],userRating:['a','c','b'],recent:['b','a','c'],visited:['a','c','b'],price:['b','c','a'],nearest:['c','b','a']})){
  w.document.getElementById('sortSelect').value=sort;ev('sortSelect');await tick();
  check('sort '+sort,()=>assert.deepEqual(Array.from(read('filteredPlaces.map(p=>p.id)')),expected));
  check('rendered order '+sort,()=>assert.deepEqual([...w.document.querySelectorAll('#listPanel article')].map(x=>x.dataset.place),expected));
 }
 check('Nearest requests device location',()=>assert.ok(geoCalls>0));
 check('null coordinates excluded',()=>assert.equal(read('distanceFor(places.find(p=>p.id==="a"))'),null));
 read('currentPosition=null;render()');check('missing GPS visible',()=>assert.match(w.document.getElementById('selectionSummary').textContent,/Location needed/));
 read('filters.type="Cafe";render()');check('filter works',()=>assert.equal(read('filteredPlaces.length'),2));
 check('chips outside collapsed filters',()=>assert.equal(w.document.getElementById('catalogueFiltersPanel').contains(w.document.getElementById('activeChips')),false));
 w.document.querySelector('[data-clear-filter="type"]').click();check('remove chip works',()=>assert.equal(read('filters.type'),''));
 read(`Object.assign(places.find(p=>p.id==='b'),{cuisine:'Spanish',mealTypes:['Breakfast'],greatFor:['Coffee'],features:['Outdoor Seating'],dietary:['Vegetarian'],tags:['Old Town'],openNow:true});personal[personalKey('b')].want=true;currentPosition={lat:37.88,lng:-4.77};`);
 for(const [id,value] of Object.entries({typeFilter:'Cafe',cuisineFilter:'Spanish',priceFilter:'$',mealFilter:'Breakfast',greatForFilter:'Coffee',featureFilter:'Outdoor Seating',dietaryFilter:'Vegetarian',tagFilter:'Old Town',statusFilter:'want',ratingFilter:'5',distanceFilter:'5',openNowFilter:'yes'})){
  read('resetFilters()');w.document.getElementById(id).value=value;ev(id);await tick();
  check('filter '+id,()=>assert.ok(read('filteredPlaces.length')<3));
 }
 read('resetFilters();');
 check('managed cuisine values retained',()=>assert.ok(Array.from(read('masterValues("cuisine")')).includes('Spanish')));
 w.document.getElementById('sourceGoogle').checked=true;ev('sourceGoogle');check('source summary updates',()=>assert.match(w.document.getElementById('selectionSummary').textContent,/Pers \+ Google/));
 read(`externalPlaceResults=[Object.assign(googleWorkerResultToPlace(${JSON.stringify(googleRow)}),{provider:'Google Places'})];render()`);await tick();
 check('external Google photo rendered',()=>assert.ok(w.document.querySelector('#externalGoogleResultsPanel .google-place-photo')));
 check('attribution preserved',()=>assert.match(w.document.querySelector('#externalGoogleResultsPanel .google-photo-attribution').textContent,/Test Photographer.*View source photo.*Report/));
 const externalFrame=w.document.querySelector('#externalGoogleResultsPanel [data-google-photo-place]');
 const before=photoCalls;read('render()');await tick();check('sort/render reuses displayed photo',()=>assert.equal(photoCalls,before));
 check('external sorting retains its photo element',()=>assert.equal(w.document.querySelector('#externalGoogleResultsPanel [data-google-photo-place]'),externalFrame));
 w.document.getElementById('sourceGoogle').checked=false;ev('sourceGoogle');check('source off hides its results',()=>assert.equal(w.document.getElementById('externalGoogleResultsPanel'),null));
 read(`places.push(normalizeLegacyPlace({id:'don',name:'Cafeteria Don Pepe',googlePlaceId:'google-don',city:'Córdoba',lat:37.88,lng:-4.77}));render()`);await tick();
 check('saved Google photo rendered',()=>assert.ok(w.document.querySelector('[data-google-photo-place="don"] .google-place-photo')));
 failPhoto=true;read('displayedGooglePhotos.clear();$("listPanel").replaceChildren();render()');await new Promise(r=>setTimeout(r,1500));
 check('provider failure visible',()=>assert.match(w.document.querySelector('[data-google-photo-place="don"]').textContent,/minute limit reached/));
 failPhoto=false;w.document.querySelector('[data-google-photo-place="don"] button').click();await tick();check('retry photo recovers',()=>assert.ok(w.document.querySelector('[data-google-photo-place="don"] .google-place-photo')));
 const donFrame=w.document.querySelector('[data-google-photo-place="don"]');
 const callsBeforeSort=photoCalls;
 w.document.getElementById('sortSelect').value='name';ev('sortSelect');await tick();
 check('sorting retains the same venue photo element',()=>assert.equal(w.document.querySelector('[data-google-photo-place="don"]'),donFrame));
 check('sorting makes no new saved photo request',()=>assert.equal(photoCalls,callsBeforeSort));
 read(`places.push(normalizeLegacyPlace({id:'casa',name:'Casa El Pimpo',city:'Córdoba',googlePlaceId:'google-casa'}));render()`);await tick();
 check('adding a venue retains existing images',()=>assert.equal(w.document.querySelector('[data-google-photo-place="don"]'),donFrame));
 check('new venue cannot borrow Don Pepe photo',()=>assert.equal(w.document.querySelector('[data-google-photo-place="casa"] .google-place-photo'),null));
 check('provider ID mismatch rejects same name',()=>assert.equal(read(`providerPhotoMatch({googlePlaceId:'other',name:'Cafeteria Don Pepe'},[${JSON.stringify(googleRow)}])`),undefined));
 check('ambiguous name matches rejected',()=>assert.equal(read(`providerPhotoMatch({name:'Cafeteria Don Pepe',city:'Córdoba',country:'Spain'},[${JSON.stringify(googleRow)},${JSON.stringify(googleRow)}])`),null));
 read('filters.type="Cafe";render()');w.document.getElementById('summaryToggle').click();
 check('summary collapses',()=>assert.equal(w.document.getElementById('selectionDetails').hidden,true));
 check('collapsed summary keeps filter count',()=>assert.match(w.document.getElementById('summaryToggle').textContent,/1 filters/));
 check('summary exposes expanded state',()=>assert.equal(w.document.getElementById('summaryToggle').getAttribute('aria-expanded'),'false'));
 read('render()');check('collapse survives rendering',()=>assert.equal(w.document.getElementById('selectionDetails').hidden,true));
 check('collapse preference saved',()=>assert.ok(w.localStorage.getItem('pers-v027f-db:pers-favourites-per-trial').includes('"summaryCollapsed":true')));
 w.document.getElementById('summaryToggle').click();check('summary expands without clearing filters',()=>{assert.equal(w.document.getElementById('selectionDetails').hidden,false);assert.equal(read('filters.type'),'Cafe');});
 read('filters=defaultFilters();places=places.filter(p=>p.id!=="casa");');
 read('render()');await tick();
 await read('openPlaceEditor()');w.document.getElementById('placeName').value='QA newly saved venue';
 const retainedBeforeSave=w.document.querySelector('[data-google-photo-place="don"]');
 await read('savePlace({preventDefault(){}})');await tick();
 check('actual Save Place retains existing photo',()=>assert.equal(w.document.querySelector('[data-google-photo-place="don"]'),retainedBeforeSave));
 check('actual Save Place persists new venue',()=>assert.ok(w.localStorage.getItem('pers-v027f-db:pers-favourites-per-trial').includes('QA newly saved venue')));
 read('places=places.filter(p=>p.name!=="QA newly saved venue");');
 const normalFetch=w.fetch,pendingPhotos=new Map();
 w.fetch=async(url,options)=>{
  const ref=options?.body?JSON.parse(options.body).photoRef:'';
  if(String(url).includes('/photo')&&ref?.includes('race-'))return new Promise(resolve=>pendingPhotos.set(ref,()=>resolve({ok:true,json:async()=>({photoUri:'https://example.test/'+ref.split('/')[1]+'.jpg'})})));
  return normalFetch(url,options);
 };
 read(`places.push(...['race-one','race-two'].map(id=>normalizeLegacyPlace({id,name:id,googlePlaceId:id,city:'Córdoba'})));for(const p of places.filter(p=>p.id.startsWith('race-')))liveExternalByPlace.set(p.id,{googlePlaceId:p.googlePlaceId,googlePhotoRef:'places/'+p.id+'/photos/test'});render()`);await tick();
 w.document.getElementById('sortSelect').value='recent';ev('sortSelect');await tick();
 pendingPhotos.get('places/race-two/photos/test')();await tick();pendingPhotos.get('places/race-one/photos/test')();await tick();
 for(const id of ['race-one','race-two'])check('out-of-order photo stays with '+id,()=>assert.equal(w.document.querySelector('[data-google-photo-place="'+id+'"] img.google-place-photo').src,'https://example.test/'+id+'.jpg'));
 w.fetch=normalFetch;read('places=places.filter(p=>!p.id.startsWith("race-"));');
 const originalFetch=w.fetch;let finishOld;
 w.fetch=async(url,options)=>String(url).includes('/photo')?new Promise(resolve=>{finishOld=()=>resolve({ok:true,json:async()=>({photoUri:'https://example.test/old-venue.jpg'})});}):originalFetch(url,options);
 const stalePhoto=read(`window.qaChangingPlace={id:'changed',name:'Old venue',googlePlaceId:'old',googlePhotoRef:'places/old/photos/one'};resolveGooglePhoto(window.qaChangingPlace)`);
 await tick();read(`window.qaChangingPlace.name='New venue';window.qaChangingPlace.googlePlaceId='new';`);finishOld();
 const staleResult=await stalePhoto;check('late response from edited venue rejected',()=>assert.equal(staleResult,null));w.fetch=originalFetch;
 read(`photos=[{id:'shared',placeId:'b',status:'approved'},{id:'shared',placeId:'c',status:'approved'}]`);
 const ambiguousBlob=await read('photoObjectUrl(photos[0])');check('duplicate photo ID across venues fails closed',()=>assert.equal(ambiguousBlob,''));read('photos=[]');
 check('photo names not persisted',()=>assert.ok(!w.localStorage.getItem('pers-v027f-db:pers-favourites-per-trial').includes('places/google-don/photos/test')));
 read('filters.country="Spain";filters.region="Andalusia";filters.city="Córdoba";populateFilterOptions();render()');check('geographic cascade',()=>assert.deepEqual(Array.from(read('filteredPlaces.map(p=>p.id)')),['b']));
 read('filters=defaultFilters();photos=[1,2,3,4,5].map(n=>({id:"ph"+n,placeId:"b",status:"approved",isCover:true,sortOrder:n}));');check('collage capped at four',()=>assert.equal(read('bannerPhotosForPlace("b").length'),4));
 read('currentUser={id:"qa-viewer",role:"viewer"};render()');check('viewer cannot edit',()=>assert.equal(w.document.querySelectorAll('#listPanel [data-edit]').length,0));
 check('owner rating excluded from user average',()=>{read('userRatings.push({placeId:"a",userId:state.users.find(u=>u.role!=="viewer").id,rating:1})');assert.equal(read('userRatingSummary("a").avg'),5);});
 read('archiveMode=false;places[0].archivedAt="2026-09-20";render()');check('archived venue hidden',()=>assert.ok(!read('filteredPlaces.some(p=>p.id==="b")')));
 read('archiveMode=true;render()');check('archive venue retained',()=>assert.ok(read('filteredPlaces.some(p=>p.id==="b")')));
 read(`currentUser=state.users.find(u=>u.role==='owner');state.users.push({id:'rating-qa-1',role:'viewer'},{id:'rating-qa-2',role:'viewer'});userRatings=[{placeId:'b',userId:'rating-qa-1',rating:3},{placeId:'b',userId:'rating-qa-2',rating:4}];places.find(p=>p.id==='b').persRating=4;openDetail('b')`);
 const ratingRows=[...w.document.querySelectorAll('.venue-rating-row')];
 check('Pers and User ratings share the same row structure',()=>assert.deepEqual(ratingRows.map(row=>[...row.children].map(el=>el.className)),[...Array(2)].map(()=>['rating-label','stars','rating-value','rating-caption muted small'])));
 check('both rating rows have five stars',()=>assert.deepEqual(ratingRows.map(row=>row.querySelectorAll('.rating-star').length),[5,5]));
 check('user average displays fractional stars',()=>{assert.equal(ratingRows[1].querySelector('.rating-value').textContent,'3.5 / 5');assert.equal(ratingRows[1].querySelectorAll('.rating-star')[3].style.getPropertyValue('--star-fill'),'50%');});
 check('Owner can edit only Pers rating',()=>{assert.equal(ratingRows[0].querySelectorAll('button[data-pers-rate]').length,5);assert.equal(ratingRows[1].querySelectorAll('button').length,0);});
 read(`currentUser={id:'rating-qa-1',role:'viewer'};openDetail('b')`);
 check('viewer cannot edit Pers average',()=>assert.equal(w.document.querySelectorAll('[data-rating-kind="pers"] button').length,0));
 check('viewer retains separate personal rating controls',()=>assert.equal(w.document.querySelectorAll('[data-user-stars="b"] button').length,5));
 console.log(JSON.stringify({passed:passes.length,passes,photoCalls,searchCalls},null,2));dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
