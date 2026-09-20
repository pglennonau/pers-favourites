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
 return {ok:true,json:async()=>({version:'0.27.24'})};
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
 const before=photoCalls;read('render()');await tick();check('sort/render reuses displayed photo',()=>assert.equal(photoCalls,before));
 w.document.getElementById('sourceGoogle').checked=false;ev('sourceGoogle');check('source off hides its results',()=>assert.equal(w.document.getElementById('externalGoogleResultsPanel'),null));
 read(`places.push(normalizeLegacyPlace({id:'don',name:'Cafeteria Don Pepe',googlePlaceId:'google-don',city:'Córdoba',lat:37.88,lng:-4.77}));render()`);await tick();
 check('saved Google photo rendered',()=>assert.ok(w.document.querySelector('[data-google-photo-place="don"] .google-place-photo')));
 failPhoto=true;read('displayedGooglePhotos.clear();render()');await new Promise(r=>setTimeout(r,1500));
 check('provider failure visible',()=>assert.match(w.document.querySelector('[data-google-photo-place="don"]').textContent,/minute limit reached/));
 failPhoto=false;w.document.querySelector('[data-google-photo-place="don"] button').click();await tick();check('retry photo recovers',()=>assert.ok(w.document.querySelector('[data-google-photo-place="don"] .google-place-photo')));
 check('photo names not persisted',()=>assert.ok(!w.localStorage.getItem('pers-v027f-db:pers-favourites-per-trial').includes('places/google-don/photos/test')));
 read('filters.country="Spain";filters.region="Andalusia";filters.city="Córdoba";populateFilterOptions();render()');check('geographic cascade',()=>assert.deepEqual(Array.from(read('filteredPlaces.map(p=>p.id)')),['b']));
 read('filters=defaultFilters();photos=[1,2,3,4,5].map(n=>({id:"ph"+n,placeId:"b",status:"approved",isCover:true,sortOrder:n}));');check('collage capped at four',()=>assert.equal(read('bannerPhotosForPlace("b").length'),4));
 read('currentUser={id:"qa-viewer",role:"viewer"};render()');check('viewer cannot edit',()=>assert.equal(w.document.querySelectorAll('#listPanel [data-edit]').length,0));
 check('owner rating excluded from user average',()=>{read('userRatings.push({placeId:"a",userId:state.users.find(u=>u.role!=="viewer").id,rating:1})');assert.equal(read('userRatingSummary("a").avg'),5);});
 read('archiveMode=false;places[0].archivedAt="2026-09-20";render()');check('archived venue hidden',()=>assert.ok(!read('filteredPlaces.some(p=>p.id==="b")')));
 read('archiveMode=true;render()');check('archive venue retained',()=>assert.ok(read('filteredPlaces.some(p=>p.id==="b")')));
 console.log(JSON.stringify({passed:passes.length,passes,photoCalls,searchCalls},null,2));dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
