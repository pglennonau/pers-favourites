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
 return {ok:true,json:async()=>({version:'0.27.33'})};
};
Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition:success=>{geoCalls++;success({coords:{latitude:37.88,longitude:-4.77,accuracy:10}});}}});
const tick=()=>new Promise(r=>setTimeout(r,15));
const ev=id=>w.document.getElementById(id).dispatchEvent(new w.Event('change',{bubbles:true}));
const read=run;
const passes=[];function check(label,fn){try{fn();passes.push(label);}catch(e){e.message=label+': '+e.message;throw e;}}
(async()=>{
 for(const file of ['config.js','geo-fallback.js','branding.js','app.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
 w.document.getElementById('startLocalBtn').click();await tick();
 check('User is the default and cannot edit',()=>{assert.equal(read('currentUser.role'),'viewer');assert.equal(read('canEdit()'),false);});
 check('Existing install switches to User once without losing data',()=>{
  const x=JSON.parse(read(`JSON.stringify(normalizeLocalState({activeUserId:'local-owner',places:[{id:'keep',name:'Keep',persRating:4}],personal:{'local-owner:keep':{privateNote:'keep private'}},photos:[{id:'photo',placeId:'keep'}],settings:{masterLists:{type:{active:['Custom Type','Jewelry'],archived:['Hospital']}}}}))`));
  assert.equal(x.activeUserId,'local-viewer');assert.equal(x.places[0].persRating,4);assert.equal(x.photos[0].id,'photo');assert.equal(x.personal['local-owner:keep'].privateNote,'keep private');
  assert.ok(x.settings.masterLists.type.active.includes('Custom Type'));assert.ok(!x.settings.masterLists.type.active.includes('Hospital'));assert.ok(!x.settings.masterLists.type.active.includes('Jewellery'));
 });
 check('Explicit role choice persists after migration',()=>assert.equal(read(`normalizeLocalState({...defaultLocalState(),activeUserId:'local-owner'}).activeUserId`),'local-owner'));
 read(`currentUser=state.users.find(u=>u.role==='owner');state.activeUserId=currentUser.id;places=[];state.places=places;preferences.sort='name';`);
 await read('openPlaceEditor()');
 for(const type of ['Shopping','Jewellery','Police Station','Hospital','Dentist','GP Clinic','Supermarket','Fountains','Public Squares']){
  check(type+' available in editor and managed lists',()=>{assert.ok([...w.document.getElementById('placeType').options].some(o=>o.value===type));assert.ok(read(`masterValues('type').includes(${JSON.stringify(type)})`));});
 }
 w.document.getElementById('placeName').value='Artisan Coffee Roaster';w.document.getElementById('placeType').value='Shopping';w.document.getElementById('placePersRating').value='4';w.document.getElementById('placeNotes').value='Owner note';w.document.getElementById('placeMustTry').value='Coffee';
 await read('savePlace({preventDefault(){}})');
 check('Add saves Owner rating and opens completion details',()=>{assert.equal(read('places[0].persRating'),4);assert.equal(w.document.getElementById('detailDialog').open,true);assert.ok(w.document.querySelector('[data-save-personal]'));assert.ok(w.document.querySelector('[data-add-photo]'));});
 const id=read('places[0].id');
 await read(`openPlaceEditor(${JSON.stringify(id)})`);w.document.getElementById('placePersRating').value='2';w.document.getElementById('placeNotes').value='Cancel this';w.document.getElementById('placeCancelBtn').click();
 check('Cancel leaves saved rating and notes unchanged',()=>{assert.equal(read('places[0].persRating'),4);assert.equal(read('places[0].notes'),'Owner note');});
 await read(`openPlaceEditor(${JSON.stringify(id)})`);w.document.getElementById('placePersRating').value='5';w.document.getElementById('placeNotes').value='Updated note';await read('savePlace({preventDefault(){}})');
 check('Edit changes rating and fields without duplicating',()=>{assert.equal(read('places.length'),1);assert.equal(read('places[0].persRating'),5);assert.equal(read('places[0].notes'),'Updated note');assert.equal(read('places[0].mustTry'),'Coffee');});
 check('Updated rating persists in browser data',()=>assert.equal(read('JSON.parse(localStorage.getItem(LS_DB)).places[0].persRating'),5));
 await read(`openPlaceEditor(${JSON.stringify(id)})`);w.document.getElementById('placePersRating').value='0';await read('savePlace({preventDefault(){}})');
 read('places[0].persRating=4.5');await read(`openPlaceEditor(${JSON.stringify(id)})`);await read('savePlace({preventDefault(){}})');
 check('Legacy fractional rating survives unchanged editing',()=>assert.equal(read('places[0].persRating'),4.5));read('places[0].persRating=0');
 check('Owner can return venue to Not rated',()=>assert.equal(read('places[0].persRating'),0));
 read(`$('detailDialog').close();liveExternalByPlace.set(places[0].id,{googleOpenNow:true});render();`);
 check('Opening status is non-button text',()=>{const el=w.document.querySelector('#listPanel .opening-status');assert.ok(el);assert.match(el.textContent,/Open Now/);assert.equal(el.tagName,'SPAN');});
 w.document.querySelector('#listPanel .venue-name-link').click();
 check('Saved venue title opens correct details',()=>{assert.equal(w.document.getElementById('detailName').textContent,'Artisan Coffee Roaster');assert.equal(w.document.getElementById('detailDialog').open,true);});
 read(`$('detailDialog').close();places[0].placeType='Jewellery';$('searchInput').value='jewelry';render();`);
 check('Jewelry search finds Jewellery',()=>assert.equal(read('filteredPlaces.length'),1));
 read(`$('searchInput').value='';places[0].placeType='Public Squares';filters.type='Public Squares';render();`);
 check('New type filters the saved venue',()=>assert.equal(read('filteredPlaces.length'),1));
 read(`currentUser=state.users.find(u=>u.role==='viewer');openDetail(places[0].id);`);
 check('User has own rating but cannot change Owner rating',()=>{assert.equal(w.document.querySelectorAll('[data-pers-rate]').length,0);assert.equal(w.document.querySelectorAll('[data-user-rate]').length,5);});
 await read(`setUserRating(places[0].id,3)`);
 read(`currentUser={id:'other-user',role:'viewer'};state.users.push(currentUser);`);await read('setUserRating(places[0].id,5)');
 check('Separate User ratings average without changing Owner rating',()=>{assert.equal(read('userRatingSummary(places[0].id).avg'),4);assert.equal(read('places[0].persRating'),0);});
 const before=read('JSON.stringify(places)');await read('savePlace({preventDefault(){}})');
 check('User save cannot change shared venue data',()=>assert.equal(read('JSON.stringify(places)'),before));
 console.log(JSON.stringify({passed:passes.length,passes},null,2));dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
