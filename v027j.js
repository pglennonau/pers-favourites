/* Pers Favourites v027j corrective UI/cascade layer. */
(function(){
  'use strict';

  const VERSION='0.27.10';
  const PLACE_TYPES=['Restaurant','Bar','Wine Bar','Cafe','Bakery','Pub','Bistro','Brasserie','Winery','Cellar Door','Hotel','Accommodation','Attraction','Market','Shop','Beach','Park','Other'];
  const CUISINES=['Australian','Basque','Catalan','Chinese','French','Greek','Indian','Italian','Japanese','Korean','Mediterranean','Mexican','Middle Eastern','Modern Australian','Modern European','Seafood','Spanish','Steakhouse','Tapas','Thai','Vegetarian','Vietnamese','Other'];
  const MEALS=['Breakfast','Brunch','Lunch','Dinner','Drinks','Coffee','Dessert','Tasting','Takeaway'];
  const GREAT_FOR=['Casual','Couples','Family','Groups','Local Favourite','Special Occasion','Visitors','Views','Wine'];
  const FEATURES=['Bar Seating','Beachfront','BYO','Historic','Outdoor Seating','Rooftop','Waterfront','Wheelchair Access','Wine List'];
  const DIETARY=['Gluten Free','Halal','Kosher','Vegan','Vegetarian'];
  const TAGS=['Great Wine','Local Favourite','Old Town','Special Occasion','Visitors','Views'];
  const FILTER_MAP={countryFilter:'country',regionFilter:'region',cityFilter:'city',typeFilter:'type',cuisineFilter:'cuisine',ratingFilter:'rating',distanceFilter:'distance',priceFilter:'price',mealFilter:'meal',greatForFilter:'greatFor',featureFilter:'feature',statusFilter:'status',dietaryFilter:'dietary',tagFilter:'tag'};
  let mainGeoSeq=0;
  let editorGeoSeq=0;
  let geoFailureShown=false;

  function el(id){return document.getElementById(id);}
  function activePlaces(){return (typeof places!=='undefined'?places:[]).filter(p=>!p.archivedAt);}
  function valueList(xs){return [...new Set(xs.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  function safeHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function addCurrent(xs,current){const c=String(current||'').trim();return c&&!xs.some(x=>geoSame(x,c))?xs.concat(c):xs;}
  function searchMatches(p){
    const q=String(el('searchInput')?.value||'').trim().toLowerCase();
    if(!q)return true;
    return [p.name,p.placeType,p.cuisine,p.country,p.stateRegion,p.city,p.suburb,p.address,p.notes,p.mustTry,...(p.tags||[])].join(' ').toLowerCase().includes(q);
  }
  function selectedStatusMatch(p,val){
    if(!val)return true;
    const x=getPersonal(p.id);
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
    let rows=activePlaces().filter(searchMatches);
    const keys=['country','region','city','type','cuisine','rating','distance','price','meal','greatFor','feature','status','dietary','tag'];
    for(const k of keys){
      if(k===excludeKey)continue;
      if(geoMode==='country'&&['country','region','city'].includes(k))continue;
      if(geoMode==='region'&&['region','city'].includes(k))continue;
      if(geoMode==='city'&&k==='city')continue;
      const v=filters[k];
      if(v)rows=rows.filter(p=>matchChoice(p,k,v));
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
    // Two passes ensure that if one incompatible selection is cleared, earlier dropdowns
    // are rebuilt against the now-valid filter state rather than remaining stale.
    for(let pass=0;pass<2;pass++){
      fillDynamic('typeFilter','Place Type','type',p=>p.placeType);
      fillDynamic('cuisineFilter','Cuisine','cuisine',p=>p.cuisine);
      fillDynamic('mealFilter','Meal / Visit Type','meal',p=>p.mealTypes||[]);
      fillDynamic('greatForFilter','Great For','greatFor',p=>p.greatFor||[]);
      fillDynamic('featureFilter','Feature','feature',p=>p.features||[]);
      fillDynamic('dietaryFilter','Dietary','dietary',p=>p.dietary||[]);
      fillDynamic('tagFilter','Personal Tag','tag',p=>p.tags||[]);
    }
  }
  function prepareGeoLoadingState(country,region,city){
    const countryControl=el('countryFilter'),regionControl=el('regionFilter'),cityControl=el('cityFilter');
    if(countryControl)countryControl.disabled=true;
    if(!country){
      populateSelect('regionFilter','Select Country first',[],'');
      populateSelect('cityFilter','Select Country first',[],'');
      if(regionControl)regionControl.disabled=true;
      if(cityControl)cityControl.disabled=true;
      return;
    }
    populateSelect('regionFilter','Loading State/Region…',[],region);
    if(regionControl)regionControl.disabled=true;
    populateSelect('cityFilter',region?'Loading City/Town…':'Select State/Region first',[],city);
    if(cityControl)cityControl.disabled=true;
  }
  async function refreshMainGeography(){
    const seq=++mainGeoSeq;
    const currentCountry=filters.country||'',currentRegion=filters.region||'',currentCity=filters.city||'';
    const countryRows=rowsForChoice('country','country');
    prepareGeoLoadingState(currentCountry,currentRegion,currentCity);
    try{
      const countries=await ensureGeoCountries();
      if(seq!==mainGeoSeq)return;
      populateSelect('countryFilter','Country',geoOptions(addCurrent(countries.map(c=>c.name),currentCountry),countryRows.map(p=>p.country),currentCountry),currentCountry);
      el('countryFilter').disabled=false;
      if(!currentCountry)return;

      const regionRows=rowsForChoice('region','region');
      const states=await ensureGeoStates(currentCountry);
      if(seq!==mainGeoSeq)return;
      populateSelect('regionFilter','State/Region',geoOptions(addCurrent(states.map(s=>s.name),currentRegion),regionRows.map(p=>p.stateRegion),currentRegion),currentRegion);
      el('regionFilter').disabled=false;
      if(!currentRegion){populateSelect('cityFilter','Select State/Region first',[],'');el('cityFilter').disabled=true;return;}

      const cityRows=rowsForChoice('city','city');
      const cities=await ensureGeoCities(currentCountry,currentRegion);
      if(seq!==mainGeoSeq)return;
      populateSelect('cityFilter','City/Town',geoOptions(addCurrent(cities.map(c=>c.name),currentCity),cityRows.map(p=>p.city),currentCity),currentCity);
      el('cityFilter').disabled=false;
    }catch(err){
      if(seq!==mainGeoSeq)return;
      const active=activePlaces().filter(searchMatches);
      populateSelect('countryFilter','Country',counted(valueList(active.map(p=>p.country))),currentCountry);el('countryFilter').disabled=false;
      const regions=valueList(active.filter(p=>!currentCountry||geoSame(p.country,currentCountry)).map(p=>p.stateRegion));
      populateSelect('regionFilter',currentCountry?'State/Region':'Select Country first',counted(regions),currentRegion);el('regionFilter').disabled=!currentCountry;
      const cities=valueList(active.filter(p=>(!currentCountry||geoSame(p.country,currentCountry))&&(!currentRegion||geoSame(p.stateRegion,currentRegion))).map(p=>p.city));
      populateSelect('cityFilter',currentRegion?'City/Town':'Select State/Region first',counted(cities),currentCity);el('cityFilter').disabled=!currentRegion;
      if(!geoFailureShown){geoFailureShown=true;toast('Geographic master list could not load. Pers is using saved venue locations for this session.');}
    }
  }
  function rebuildFilters(){
    refreshNonGeoFilters();
    void refreshMainGeography();
    syncFilterControls();
  }

  function replaceInputWithSelect(id){
    const old=el(id);
    if(!old||old.tagName==='SELECT')return old;
    const s=document.createElement('select');
    s.id=old.id;s.className=old.className;s.disabled=old.disabled;
    if(old.required)s.required=true;
    old.replaceWith(s);
    return s;
  }
  function setPlainSelect(id,label,values,current){
    const s=el(id);if(!s)return;
    const all=valueList(values.concat(current?[current]:[]));
    s.innerHTML=`<option value="">${safeHtml(label)}</option>`+all.map(v=>`<option value="${safeHtml(v)}">${safeHtml(v)}</option>`).join('');
    s.value=current||'';
  }
  function refreshEditorTaxonomy(target={}){
    const type=String(target.placeType??el('placeType')?.value??'').trim();
    const cuisine=String(target.cuisine??el('placeCuisine')?.value??'').trim();
    const observedTypes=valueList(activePlaces().map(p=>p.placeType));
    const observedCuisines=valueList(activePlaces().map(p=>p.cuisine));
    setPlainSelect('placeType','Select Place Type',PLACE_TYPES.concat(observedTypes),type);
    setPlainSelect('placeCuisine','Select Cuisine',CUISINES.concat(observedCuisines),cuisine);
  }
  function attachDatalist(id,defaults,getter){
    const input=el(id);if(!input||input.tagName==='SELECT')return;
    const listId=`${id}Choices`;let list=el(listId);
    if(!list){list=document.createElement('datalist');list.id=listId;document.body.appendChild(list);}
    const observed=activePlaces().flatMap(p=>{const v=getter(p);return Array.isArray(v)?v:[v];}).filter(Boolean);
    list.innerHTML=valueList(defaults.concat(observed)).map(v=>`<option value="${safeHtml(v)}"></option>`).join('');
    input.setAttribute('list',listId);input.setAttribute('autocomplete','off');
  }
  function multiConfig(id){
    return {
      placeMeals:{label:'Add Meal / Visit Type',defaults:MEALS,getter:p=>p.mealTypes||[]},
      placeGreatFor:{label:'Add Great For',defaults:GREAT_FOR,getter:p=>p.greatFor||[]},
      placeFeatures:{label:'Add Feature',defaults:FEATURES,getter:p=>p.features||[]},
      placeDietary:{label:'Add Dietary',defaults:DIETARY,getter:p=>p.dietary||[]},
      placeTags:{label:'Add Personal Tag',defaults:TAGS,getter:p=>p.tags||[]}
    }[id];
  }
  function ensureMultiEditor(id){
    const input=el(id),cfg=multiConfig(id);
    if(!input||!cfg)return;
    input.classList.add('hidden');
    input.setAttribute('aria-hidden','true');
    let wrap=el(`${id}Editor`);
    if(!wrap){
      wrap=document.createElement('div');wrap.id=`${id}Editor`;wrap.className='multi-choice-editor';
      wrap.innerHTML=`<select id="${id}Picker" aria-label="${safeHtml(cfg.label)}"></select><div id="${id}Chips" class="multi-choice-chips"></div>`;
      input.insertAdjacentElement('afterend',wrap);
      const picker=el(`${id}Picker`);
      picker.onchange=()=>{
        const choice=String(picker.value||'').trim();
        if(!choice)return;
        const vals=arr(input.value);
        if(!vals.includes(choice))vals.push(choice);
        input.value=vals.join(', ');
        picker.value='';
        refreshMultiEditor(id);
      };
      el(`${id}Chips`).onclick=e=>{
        const b=e.target.closest('[data-remove-multi]');if(!b)return;
        const vals=arr(input.value).filter(v=>v!==b.dataset.removeMulti);
        input.value=vals.join(', ');
        refreshMultiEditor(id);
      };
    }
    refreshMultiEditor(id);
  }
  function refreshMultiEditor(id){
    const input=el(id),cfg=multiConfig(id),picker=el(`${id}Picker`),chips=el(`${id}Chips`);
    if(!input||!cfg||!picker||!chips)return;
    const selected=arr(input.value);
    const observed=activePlaces().flatMap(cfg.getter).filter(Boolean);
    const available=valueList(cfg.defaults.concat(observed)).filter(v=>!selected.includes(v));
    picker.innerHTML=`<option value="">${safeHtml(cfg.label)}…</option>`+available.map(v=>`<option value="${safeHtml(v)}">${safeHtml(v)}</option>`).join('');
    chips.innerHTML=selected.length?selected.map(v=>`<span class="multi-choice-chip">${safeHtml(v)} <button type="button" data-remove-multi="${safeHtml(v)}" aria-label="Remove ${safeHtml(v)}">×</button></span>`).join(''):'<span class="muted small">None selected</span>';
  }
  function refreshAllMultiEditors(){['placeMeals','placeGreatFor','placeFeatures','placeDietary','placeTags'].forEach(refreshMultiEditor);}
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
      setPlainSelect('placeCity','Select City/Town',cities.map(c=>c.name),city);el('placeCity').disabled=false;
      refreshSuburbChoices();
    }catch(err){
      const rows=activePlaces();
      setPlainSelect('placeCountry','Country',valueList(rows.map(p=>p.country)),country);el('placeCountry').disabled=false;
      setPlainSelect('placeRegion','State/Region',valueList(rows.filter(p=>!country||geoSame(p.country,country)).map(p=>p.stateRegion)),region);el('placeRegion').disabled=!country;
      setPlainSelect('placeCity','City/Town',valueList(rows.filter(p=>(!country||geoSame(p.country,country))&&(!region||geoSame(p.stateRegion,region))).map(p=>p.city)),city);el('placeCity').disabled=!region;
      refreshSuburbChoices();
    }
  }
  function installEditorStyles(){
    if(el('v027jStyles'))return;
    const style=document.createElement('style');style.id='v027jStyles';
    style.textContent='.multi-choice-editor{display:grid;gap:7px;margin-top:6px}.multi-choice-chips{display:flex;flex-wrap:wrap;gap:6px}.multi-choice-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid #d7d2c8;background:#f6f4ee;border-radius:999px;padding:5px 8px;font-size:.82rem}.multi-choice-chip button{padding:0 2px;background:transparent;font-size:1rem;line-height:1}.v027j-field-note{font-size:.76rem;color:#69736d;margin-top:4px}';
    document.head.appendChild(style);
  }
  function setupEditorChoices(){
    installEditorStyles();
    replaceInputWithSelect('placeCountry');replaceInputWithSelect('placeRegion');replaceInputWithSelect('placeCity');
    replaceInputWithSelect('placeType');replaceInputWithSelect('placeCuisine');
    refreshEditorTaxonomy();
    ['placeMeals','placeGreatFor','placeFeatures','placeDietary','placeTags'].forEach(ensureMultiEditor);
    refreshSuburbChoices();
    const c=el('placeCountry'),r=el('placeRegion'),ct=el('placeCity');
    if(c)c.onchange=()=>{if(r)r.value='';if(ct)ct.value='';void hydrateEditorGeography({country:c.value,region:'',city:''});};
    if(r)r.onchange=()=>{if(ct)ct.value='';void hydrateEditorGeography({country:c?.value||'',region:r.value,city:''});};
    if(ct)ct.onchange=refreshSuburbChoices;
  }
  function closePlaceEditor(){const d=el('placeDialog');if(d?.open)d.close('cancel');}
  function patchEditorCancel(){
    const form=el('placeForm');if(!form)return;
    const close=form.querySelector('.modal-head button');
    const cancel=[...form.querySelectorAll('.modal-actions button')].find(b=>b.textContent.trim()==='Cancel');
    [close,cancel].filter(Boolean).forEach(b=>{
      b.type='button';b.removeAttribute('value');
      b.onclick=e=>{e.preventDefault();e.stopPropagation();closePlaceEditor();};
    });
    form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closePlaceEditor();}});
  }
  function patchOpenPlaceEditor(){
    const original=openPlaceEditor;
    openPlaceEditor=function(id=''){
      const p=id?places.find(x=>x.id===id):null;
      original(id);
      setupEditorChoices();
      refreshEditorTaxonomy({placeType:p?.placeType||'',cuisine:p?.cuisine||''});
      refreshAllMultiEditors();
      void hydrateEditorGeography({country:p?.country||'',region:p?.stateRegion||'',city:p?.city||''});
    };
    const add=el('addPlaceBtn');if(add)add.onclick=()=>openPlaceEditor();
  }
  function patchOnlinePlaceUse(){
    const original=useOnlinePlace;
    useOnlinePlace=function(i){
      const p=onlinePlaceResults?.[+i]?.place;
      original(i);
      if(p){
        refreshEditorTaxonomy({placeType:p.placeType||'',cuisine:p.cuisine||''});
        void hydrateEditorGeography({country:p.country||'',region:p.stateRegion||'',city:p.city||''});
      }
      refreshAllMultiEditors();
    };
    const results=el('findPlaceResults');if(results)results.onclick=e=>{const b=e.target.closest('[data-use-online]');if(b)useOnlinePlace(b.dataset.useOnline);};
  }
  function patchFilterEvents(){
    Object.entries(FILTER_MAP).forEach(([id,key])=>{
      const control=el(id);if(!control)return;
      control.onchange=()=>{
        filters[key]=control.value;
        if(key==='country'){filters.region='';filters.city='';}
        if(key==='region')filters.city='';
        rebuildFilters();render();
      };
    });
    const chips=el('activeChips');
    if(chips)chips.onclick=e=>{
      const b=e.target.closest('[data-clear-filter]');
      if(b){
        const k=b.dataset.clearFilter;filters[k]='';
        if(k==='country'){filters.region='';filters.city='';}
        if(k==='region')filters.city='';
        rebuildFilters();render();return;
      }
      if(e.target.closest('[data-clear-area]')){mapBoundsFilter=null;render();}
    };
    const search=el('searchInput');if(search)search.oninput=()=>{rebuildFilters();render();};
    const clear=el('clearSearchBtn');if(clear)clear.onclick=()=>{if(search)search.value='';rebuildFilters();render();};
  }
  function patchFilterFunctions(){
    populateFilterOptions=function(){rebuildFilters();};
    const originalQuick=quickFilter;
    quickFilter=function(which){originalQuick(which);rebuildFilters();};
    const originalAsk=runAskPers;
    runAskPers=async function(){await originalAsk();rebuildFilters();render();};
  }
  function patchMutationRefresh(){
    const wrapAsync=name=>{
      const original=globalThis[name];
      if(typeof original!=='function')return;
      globalThis[name]=async function(...args){const result=await original.apply(this,args);rebuildFilters();return result;};
    };
    // Function declarations are global properties in this classic-script PWA.
    ['archivePlace','restorePlace','deleteForever'].forEach(wrapAsync);
  }
  function patchVersionText(){const v=el('versionLabel');if(v)v.textContent=VERSION;}

  function qaModel(){
    const sample=[
      {country:'Spain',stateRegion:'Andalusia',city:'Granada',placeType:'Restaurant',cuisine:'Spanish'},
      {country:'Spain',stateRegion:'Balearic Islands',city:'Palma',placeType:'Wine Bar',cuisine:'Spanish'},
      {country:'Australia',stateRegion:'Victoria',city:'Melbourne',placeType:'Restaurant',cuisine:'Italian'}
    ];
    const by=(key,val)=>sample.filter(p=>geoSame(p[key],val));
    return {
      spainHasTwo:by('country','Spain').length===2,
      andalusiaOnlyGranada:by('stateRegion','Andalusia').length===1&&by('stateRegion','Andalusia')[0].city==='Granada',
      victoriaOnlyMelbourne:by('stateRegion','Victoria').length===1&&by('stateRegion','Victoria')[0].city==='Melbourne'
    };
  }
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
    check('editor place type dropdown',el('placeType')?.tagName==='SELECT');
    check('editor cuisine dropdown',el('placeCuisine')?.tagName==='SELECT');
    ['placeMeals','placeGreatFor','placeFeatures','placeDietary','placeTags'].forEach(id=>check(`${id} picker`,!!el(`${id}Picker`)));
    const form=el('placeForm'),close=form?.querySelector('.modal-head button'),cancel=[...(form?.querySelectorAll('.modal-actions button')||[])].find(b=>b.textContent.trim()==='Cancel');
    check('editor close cannot submit',close?.type==='button');
    check('editor cancel cannot submit',cancel?.type==='button');
    check('country cascade handler',typeof el('countryFilter')?.onchange==='function');
    check('region cascade handler',typeof el('regionFilter')?.onchange==='function');
    check('dependent filter handler',typeof el('typeFilter')?.onchange==='function');
    check('search rebuild handler',typeof el('searchInput')?.oninput==='function');
    const model=qaModel();Object.entries(model).forEach(([name,pass])=>check(`model ${name}`,pass));
    return {version:VERSION,passed:checks.filter(x=>x.pass).length,total:checks.length,checks};
  }
  async function qaAsync(){
    const checks=[];const check=(name,pass,detail='')=>checks.push({name,pass:!!pass,detail});
    try{
      const countries=await ensureGeoCountries();
      check('geography contains Spain',countries.some(c=>geoSame(c.name,'Spain')));
      check('geography contains Australia',countries.some(c=>geoSame(c.name,'Australia')));
      const spainStates=await ensureGeoStates('Spain');
      check('Spain contains Andalusia',spainStates.some(s=>geoSame(s.name,'Andalusia')));
      check('Spain contains Balearic Islands',spainStates.some(s=>geoSame(s.name,'Balearic Islands')));
      const andalusiaCities=await ensureGeoCities('Spain','Andalusia');
      check('Andalusia contains Granada',andalusiaCities.some(c=>geoSame(c.name,'Granada')));
      check('Andalusia contains Malaga',andalusiaCities.some(c=>geoSame(c.name,'Malaga')||geoSame(c.name,'Málaga')));
      const vicCities=await ensureGeoCities('Australia','Victoria');
      check('Victoria contains Melbourne',vicCities.some(c=>geoSame(c.name,'Melbourne')));
    }catch(err){check('geography service reachable',false,err?.message||String(err));}
    return {version:VERSION,passed:checks.filter(x=>x.pass).length,total:checks.length,checks};
  }
  function init(){
    if(!el('placeForm')||typeof filters==='undefined'||typeof openPlaceEditor!=='function')return setTimeout(init,80);
    patchFilterFunctions();
    setupEditorChoices();
    patchEditorCancel();
    patchOpenPlaceEditor();
    patchOnlinePlaceUse();
    patchFilterEvents();
    patchMutationRefresh();
    patchVersionText();
    rebuildFilters();
    window.PERS_QA_027J={run:qa,runAsync:qaAsync,version:VERSION,rebuildFilters,hydrateEditorGeography};
    const result=qa();
    if(result.passed!==result.total)console.warn('Pers v027j structural QA warnings',result);else console.info(`Pers v027j structural QA ${result.passed}/${result.total} passed`);
    qaAsync().then(r=>{window.PERS_QA_027J.lastAsync=r;if(r.passed!==r.total)console.warn('Pers v027j geographic QA warnings',r);else console.info(`Pers v027j geographic QA ${r.passed}/${r.total} passed`);});
  }

  init();
})();