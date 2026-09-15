/* Pers Favourites v027j corrective UI/cascade layer. */
(function(){
  const VERSION='0.27.10';
  const PLACE_TYPES=['Restaurant','Bar','Wine Bar','Cafe','Bakery','Pub','Bistro','Brasserie','Winery','Cellar Door','Hotel','Accommodation','Attraction','Market','Shop','Beach','Park','Other'];
  const CUISINES=['Australian','Basque','Catalan','Chinese','French','Greek','Indian','Italian','Japanese','Korean','Mediterranean','Mexican','Middle Eastern','Modern Australian','Modern European','Seafood','Spanish','Steakhouse','Tapas','Thai','Vegetarian','Vietnamese'];
  const MEALS=['Breakfast','Brunch','Lunch','Dinner','Drinks','Coffee','Dessert','Tasting','Takeaway'];
  const GREAT_FOR=['Casual','Couples','Family','Groups','Local Favourite','Special Occasion','Visitors','Views','Wine'];
  const FEATURES=['Bar Seating','Beachfront','BYO','Historic','Outdoor Seating','Rooftop','Waterfront','Wheelchair Access','Wine List'];
  const DIETARY=['Gluten Free','Halal','Kosher','Vegan','Vegetarian'];
  const TAGS=['Great Wine','Local Favourite','Old Town','Special Occasion','Visitors','Views'];
  let mainGeoSeq=0, editorGeoSeq=0, geoFailureShown=false;

  function el(id){return document.getElementById(id);}
  function activePlaces(){return (typeof places!=='undefined'?places:[]).filter(p=>!p.archivedAt);}
  function valueList(xs){return [...new Set(xs.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  function addCurrent(xs,current){const c=String(current||'').trim();return c&&!xs.some(x=>geoSame(x,c))?xs.concat(c):xs;}
  function selectedStatusMatch(p,val){
    if(!val)return true; const x=getPersonal(p.id);
    if(val==='favourite')return !!x.favourite;
    if(val==='want')return !!x.want;
    if(val==='visited')return !!x.visited;
    if(val==='regular')return !!x.favourite&&!!x.visited;
    if(val==='unrated')return !x.rating;
    return true;
  }
  function matchChoice(p,key,val){
    if(!val)return true;
    switch(key){
      case 'country':return geoSame(p.country,val);
      case 'region':return geoSame(p.stateRegion,val);
      case 'city':return geoSame(p.city,val);
      case 'type':return p.placeType===val;
      case 'cuisine':return p.cuisine===val;
      case 'price':return p.price===val;
      case 'meal':return (p.mealTypes||[]).includes(val);
      case 'greatFor':return (p.greatFor||[]).includes(val);
      case 'feature':return (p.features||[]).includes(val);
      case 'dietary':return (p.dietary||[]).includes(val);
      case 'tag':return (p.tags||[]).includes(val);
      case 'rating':return +userRatingSummary(p.id).avg>=+val;
      case 'distance':{const d=distanceFor(p);return d!=null&&d<=+val;}
      case 'status':return selectedStatusMatch(p,val);
      default:return true;
    }
  }
  function rowsForChoice(excludeKey,geoMode='normal'){
    let rows=activePlaces();
    const keys=['country','region','city','type','cuisine','rating','distance','price','meal','greatFor','feature','status','dietary','tag'];
    for(const k of keys){
      if(k===excludeKey)continue;
      if(geoMode==='country'&&['country','region','city'].includes(k))continue;
      if(geoMode==='region'&&['region','city'].includes(k))continue;
      if(geoMode==='city'&&k==='city')continue;
      const v=filters[k]; if(v)rows=rows.filter(p=>matchChoice(p,k,v));
    }
    return rows;
  }
  function countOptions(values,rows,getter){
    const counts=new Map();
    rows.forEach(p=>{const raw=getter(p);(Array.isArray(raw)?raw:[raw]).filter(Boolean).forEach(v=>counts.set(v,(counts.get(v)||0)+1));});
    return valueList(values).map(v=>({value:v,label:counts.get(v)?`${v} (${counts.get(v)})`:v}));
  }
  function fillDynamic(id,label,key,getter){
    const rows=rowsForChoice(key);
    const values=valueList(rows.flatMap(p=>{const v=getter(p);return Array.isArray(v)?v:[v];}).filter(Boolean));
    const current=filters[key]||'';
    populateSelect(id,label,countOptions(values,rows,getter),current);
    if(current&&!values.includes(current))filters[key]='';
  }
  function refreshNonGeoFilters(){
    fillDynamic('typeFilter','Place Type','type',p=>p.placeType);
    fillDynamic('cuisineFilter','Cuisine','cuisine',p=>p.cuisine);
    fillDynamic('mealFilter','Meal / Visit Type','meal',p=>p.mealTypes||[]);
    fillDynamic('greatForFilter','Great For','greatFor',p=>p.greatFor||[]);
    fillDynamic('featureFilter','Feature','feature',p=>p.features||[]);
    fillDynamic('dietaryFilter','Dietary','dietary',p=>p.dietary||[]);
    fillDynamic('tagFilter','Personal Tag','tag',p=>p.tags||[]);
  }
  async function refreshMainGeography(){
    const seq=++mainGeoSeq;
    const currentCountry=filters.country||'',currentRegion=filters.region||'',currentCity=filters.city||'';
    const countryRows=rowsForChoice('country','country');
    try{
      const countries=await ensureGeoCountries(); if(seq!==mainGeoSeq)return;
      populateSelect('countryFilter','Country',geoOptions(addCurrent(countries.map(c=>c.name),currentCountry),countryRows.map(p=>p.country),currentCountry),currentCountry);
      el('countryFilter').disabled=false;
      if(!currentCountry){populateSelect('regionFilter','Select Country first',[],'');el('regionFilter').disabled=true;populateSelect('cityFilter','Select Country first',[],'');el('cityFilter').disabled=true;return;}
      populateSelect('regionFilter','Loading State/Region…',[],currentRegion);el('regionFilter').disabled=true;
      populateSelect('cityFilter','Select State/Region first',[],currentCity);el('cityFilter').disabled=true;
      const regionRows=rowsForChoice('region','region');
      const states=await ensureGeoStates(currentCountry); if(seq!==mainGeoSeq)return;
      populateSelect('regionFilter','State/Region',geoOptions(addCurrent(states.map(s=>s.name),currentRegion),regionRows.map(p=>p.stateRegion),currentRegion),currentRegion);
      el('regionFilter').disabled=false;
      if(!currentRegion)return;
      populateSelect('cityFilter','Loading City/Town…',[],currentCity);el('cityFilter').disabled=true;
      const cityRows=rowsForChoice('city','city');
      const cities=await ensureGeoCities(currentCountry,currentRegion); if(seq!==mainGeoSeq)return;
      populateSelect('cityFilter','City/Town',geoOptions(addCurrent(cities.map(c=>c.name),currentCity),cityRows.map(p=>p.city),currentCity),currentCity);
      el('cityFilter').disabled=false;
    }catch(err){
      if(seq!==mainGeoSeq)return;
      const active=activePlaces();
      populateSelect('countryFilter','Country',counted(valueList(active.map(p=>p.country))),currentCountry);el('countryFilter').disabled=false;
      const regions=valueList(active.filter(p=>!currentCountry||geoSame(p.country,currentCountry)).map(p=>p.stateRegion));
      populateSelect('regionFilter',currentCountry?'State/Region':'Select Country first',counted(regions),currentRegion);el('regionFilter').disabled=!currentCountry;
      const cities=valueList(active.filter(p=>(!currentCountry||geoSame(p.country,currentCountry))&&(!currentRegion||geoSame(p.stateRegion,currentRegion))).map(p=>p.city));
      populateSelect('cityFilter',currentRegion?'City/Town':'Select State/Region first',counted(cities),currentCity);el('cityFilter').disabled=!currentRegion;
      if(!geoFailureShown){geoFailureShown=true;toast('Geographic master list could not load. Pers is using saved venue locations for this session.');}
    }
  }
  function rebuildFilters(){refreshNonGeoFilters();void refreshMainGeography();syncFilterControls();}

  function attachDatalist(id,defaults,getter){
    const input=el(id);if(!input||input.tagName==='SELECT')return;
    const listId=`${id}Choices`;let list=el(listId);
    if(!list){list=document.createElement('datalist');list.id=listId;document.body.appendChild(list);}
    const observed=activePlaces().flatMap(p=>{const v=getter(p);return Array.isArray(v)?v:[v];}).filter(Boolean);
    list.innerHTML=valueList(defaults.concat(observed)).map(v=>`<option value="${String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></option>`).join('');
    input.setAttribute('list',listId);input.setAttribute('autocomplete','off');
  }
  function replaceInputWithSelect(id){
    const old=el(id);if(!old||old.tagName==='SELECT')return old;
    const s=document.createElement('select');s.id=old.id;s.className=old.className;s.disabled=old.disabled;if(old.required)s.required=true;old.replaceWith(s);return s;
  }
  function setPlainSelect(id,label,values,current){
    const s=el(id);if(!s)return;
    const all=valueList(values.concat(current?[current]:[]));
    const safe=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    s.innerHTML=`<option value="">${safe(label)}</option>`+all.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');s.value=current||'';
  }
  function refreshSuburbChoices(){
    const input=el('placeSuburb');if(!input)return;
    const country=el('placeCountry')?.value||'',region=el('placeRegion')?.value||'',city=el('placeCity')?.value||'';
    const rows=activePlaces().filter(p=>(!country||geoSame(p.country,country))&&(!region||geoSame(p.stateRegion,region))&&(!city||geoSame(p.city,city)));
    attachDatalist('placeSuburb',valueList(rows.map(p=>p.suburb)),p=>p.suburb);
  }
  async function hydrateEditorGeography(target={}){
    const seq=++editorGeoSeq;
    const country=String(target.country??el('placeCountry')?.value??'').trim();
    const region=String(target.region??el('placeRegion')?.value??'').trim();
    const city=String(target.city??el('placeCity')?.value??'').trim();
    try{
      setPlainSelect('placeCountry','Loading countries…',[],country);el('placeCountry').disabled=true;
      const countries=await ensureGeoCountries();if(seq!==editorGeoSeq)return;
      setPlainSelect('placeCountry','Select Country',countries.map(c=>c.name),country);el('placeCountry').disabled=false;
      if(!country){setPlainSelect('placeRegion','Select Country first',[],'');el('placeRegion').disabled=true;setPlainSelect('placeCity','Select Country first',[],'');el('placeCity').disabled=true;refreshSuburbChoices();return;}
      setPlainSelect('placeRegion','Loading State/Region…',[],region);el('placeRegion').disabled=true;
      const states=await ensureGeoStates(country);if(seq!==editorGeoSeq)return;
      setPlainSelect('placeRegion','Select State/Region',states.map(s=>s.name),region);el('placeRegion').disabled=false;
      if(!region){setPlainSelect('placeCity','Select State/Region first',[],'');el('placeCity').disabled=true;refreshSuburbChoices();return;}
      setPlainSelect('placeCity','Loading City/Town…',[],city);el('placeCity').disabled=true;
      const cities=await ensureGeoCities(country,region);if(seq!==editorGeoSeq)return;
      setPlainSelect('placeCity','Select City/Town',cities.map(c=>c.name),city);el('placeCity').disabled=false;refreshSuburbChoices();
    }catch(err){
      const rows=activePlaces();
      setPlainSelect('placeCountry','Country',valueList(rows.map(p=>p.country)),country);el('placeCountry').disabled=false;
      setPlainSelect('placeRegion','State/Region',valueList(rows.filter(p=>!country||geoSame(p.country,country)).map(p=>p.stateRegion)),region);el('placeRegion').disabled=!country;
      setPlainSelect('placeCity','City/Town',valueList(rows.filter(p=>(!country||geoSame(p.country,country))&&(!region||geoSame(p.stateRegion,region))).map(p=>p.city)),city);el('placeCity').disabled=!region;refreshSuburbChoices();
    }
  }
  function setupEditorChoices(){
    replaceInputWithSelect('placeCountry');replaceInputWithSelect('placeRegion');replaceInputWithSelect('placeCity');
    attachDatalist('placeType',PLACE_TYPES,p=>p.placeType);
    attachDatalist('placeCuisine',CUISINES,p=>p.cuisine);
    attachDatalist('placeMeals',MEALS,p=>p.mealTypes||[]);
    attachDatalist('placeGreatFor',GREAT_FOR,p=>p.greatFor||[]);
    attachDatalist('placeFeatures',FEATURES,p=>p.features||[]);
    attachDatalist('placeDietary',DIETARY,p=>p.dietary||[]);
    attachDatalist('placeTags',TAGS,p=>p.tags||[]);
    refreshSuburbChoices();
    const c=el('placeCountry'),r=el('placeRegion'),ct=el('placeCity');
    if(c)c.onchange=()=>{if(r)r.value='';if(ct)ct.value='';void hydrateEditorGeography({country:c.value,region:'',city:''});};
    if(r)r.onchange=()=>{if(ct)ct.value='';void hydrateEditorGeography({country:c?.value||'',region:r.value,city:''});};
    if(ct)ct.onchange=refreshSuburbChoices;
  }
  function closePlaceEditor(){const d=el('placeDialog');if(d?.open)d.close('cancel');}
  function patchEditorCancel(){
    const form=el('placeForm');if(!form)return;
    const close=form.querySelector('.modal-head button');const cancel=form.querySelector('.modal-actions button[value="cancel"]');
    [close,cancel].filter(Boolean).forEach(b=>{b.type='button';b.removeAttribute('value');b.onclick=e=>{e.preventDefault();e.stopPropagation();closePlaceEditor();};});
    form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closePlaceEditor();}});
  }
  function patchOpenPlaceEditor(){
    const original=openPlaceEditor;
    openPlaceEditor=function(id=''){
      const p=id?places.find(x=>x.id===id):null;original(id);setupEditorChoices();void hydrateEditorGeography({country:p?.country||'',region:p?.stateRegion||'',city:p?.city||''});
    };
    const add=el('addPlaceBtn');if(add)add.onclick=()=>openPlaceEditor();
  }
  function patchOnlinePlaceUse(){
    const original=useOnlinePlace;
    useOnlinePlace=function(i){const p=onlinePlaceResults?.[+i]?.place;original(i);if(p)void hydrateEditorGeography({country:p.country||'',region:p.stateRegion||'',city:p.city||''});};
    const results=el('findPlaceResults');if(results)results.onclick=e=>{const b=e.target.closest('[data-use-online]');if(b)useOnlinePlace(b.dataset.useOnline);};
  }
  function patchFilterEvents(){
    const map={countryFilter:'country',regionFilter:'region',cityFilter:'city',typeFilter:'type',cuisineFilter:'cuisine',ratingFilter:'rating',distanceFilter:'distance',priceFilter:'price',mealFilter:'meal',greatForFilter:'greatFor',featureFilter:'feature',statusFilter:'status',dietaryFilter:'dietary',tagFilter:'tag'};
    Object.entries(map).forEach(([id,key])=>{const control=el(id);if(!control)return;control.onchange=()=>{filters[key]=control.value;if(key==='country'){filters.region='';filters.city='';}if(key==='region')filters.city='';rebuildFilters();render();};});
    const chips=el('activeChips');if(chips)chips.onclick=e=>{const b=e.target.closest('[data-clear-filter]');if(b){const k=b.dataset.clearFilter;filters[k]='';if(k==='country'){filters.region='';filters.city='';}if(k==='region')filters.city='';rebuildFilters();render();return;}if(e.target.closest('[data-clear-area]')){mapBoundsFilter=null;render();}};
  }
  function patchFilterFunctions(){
    populateFilterOptions=function(){rebuildFilters();};
    const oq=quickFilter;quickFilter=function(which){oq(which);rebuildFilters();};
    const reset=el('resetFiltersBtn');if(reset)reset.onclick=()=>{archiveMode=false;resetFilters();rebuildFilters();};
  }
  function patchVersionText(){const v=el('versionLabel');if(v)v.textContent=VERSION;}
  function qa(){
    const checks=[];const check=(name,pass,detail='')=>checks.push({name,pass:!!pass,detail});
    check('release version',CFG.version===VERSION,CFG.version);
    check('front country dropdown',el('countryFilter')?.tagName==='SELECT');
    check('front region dropdown',el('regionFilter')?.tagName==='SELECT');
    check('front city dropdown',el('cityFilter')?.tagName==='SELECT');
    check('front place type dropdown',el('typeFilter')?.tagName==='SELECT');
    check('front cuisine dropdown',el('cuisineFilter')?.tagName==='SELECT');
    check('editor country dropdown',el('placeCountry')?.tagName==='SELECT');
    check('editor region dropdown',el('placeRegion')?.tagName==='SELECT');
    check('editor city dropdown',el('placeCity')?.tagName==='SELECT');
    const form=el('placeForm'),close=form?.querySelector('.modal-head button'),cancel=[...(form?.querySelectorAll('.modal-actions button')||[])].find(b=>b.textContent.trim()==='Cancel');
    check('editor close cannot submit',close?.type==='button');
    check('editor cancel cannot submit',cancel?.type==='button');
    check('country cascade handler',typeof el('countryFilter')?.onchange==='function');
    check('region cascade handler',typeof el('regionFilter')?.onchange==='function');
    check('dependent filter handler',typeof el('typeFilter')?.onchange==='function');
    return {version:VERSION,passed:checks.filter(x=>x.pass).length,total:checks.length,checks};
  }
  function init(){
    if(!el('placeForm')||typeof filters==='undefined'||typeof openPlaceEditor!=='function')return setTimeout(init,80);
    patchFilterFunctions();setupEditorChoices();patchEditorCancel();patchOpenPlaceEditor();patchOnlinePlaceUse();patchFilterEvents();patchVersionText();rebuildFilters();
    window.PERS_QA_027J={run:qa,version:VERSION,rebuildFilters,hydrateEditorGeography};
    const result=qa();if(result.passed!==result.total)console.warn('Pers v027j QA warnings',result);else console.info(`Pers v027j QA ${result.passed}/${result.total} passed`);
  }
  init();
})();