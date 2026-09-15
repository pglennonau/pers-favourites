import { test, expect } from '@playwright/test';

const catalogue = [
  {name:'Granada Table',placeType:'Restaurant',cuisine:'Spanish',country:'Spain',stateRegion:'Andalusia',city:'Granada',suburb:'Centro',address:'Granada, Spain',mealTypes:['Lunch','Dinner'],greatFor:['Visitors'],features:['Outdoor Seating'],dietary:['Vegetarian'],tags:['Old Town']},
  {name:'Malaga Wine Room',placeType:'Wine Bar',cuisine:'Spanish',country:'Spain',stateRegion:'Andalusia',city:'Malaga',suburb:'Centro',address:'Malaga, Spain',mealTypes:['Drinks'],greatFor:['Wine'],features:['Wine List'],dietary:[],tags:['Great Wine']},
  {name:'Palma Terrace',placeType:'Restaurant',cuisine:'Mediterranean',country:'Spain',stateRegion:'Balearic Islands',city:'Palma',suburb:'Old Town',address:'Palma, Spain',mealTypes:['Dinner'],greatFor:['Views'],features:['Outdoor Seating'],dietary:['Vegetarian'],tags:['Old Town']},
  {name:'Melbourne Pasta',placeType:'Restaurant',cuisine:'Italian',country:'Australia',stateRegion:'Victoria',city:'Melbourne',suburb:'CBD',address:'Melbourne, Australia',mealTypes:['Dinner'],greatFor:['Casual'],features:[],dietary:['Vegetarian'],tags:['Local Favourite']}
];

const geographyModule = `
export async function getCountries(){return [
  {name:'Australia',iso2:'AU'},
  {name:'Spain',iso2:'ES'}
];}
export async function getStatesOfCountry(iso){
  if(iso==='ES') return [{name:'Andalusia',iso2:'AN'},{name:'Balearic Islands',iso2:'IB'}];
  if(iso==='AU') return [{name:'Victoria',iso2:'VIC'}];
  return [];
}
export async function getCitiesOfState(country,state){
  if(country==='ES'&&state==='AN') return [{name:'Granada'},{name:'Malaga'}];
  if(country==='ES'&&state==='IB') return [{name:'Palma'}];
  if(country==='AU'&&state==='VIC') return [{name:'Melbourne'}];
  return [];
}
`;

async function values(page,id){
  return page.locator(`#${id} option`).evaluateAll(opts=>opts.map(o=>o.value));
}

async function startApp(page){
  await page.route('**/@countrystatecity/countries-browser@1.0.4/+esm', async route => {
    await route.fulfill({
      status:200,
      contentType:'application/javascript',
      headers:{'access-control-allow-origin':'*'},
      body:geographyModule
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('pers-v027f-session:pers-favourites-per-trial','local-started');
  });
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#appScreen')).toBeVisible();
  await page.waitForFunction(()=>window.PERS_TEST?.seedCatalogue);
  await page.evaluate(rows=>window.PERS_TEST.seedCatalogue(rows), catalogue);
}

test('opening filters cascade against the Pers catalogue', async ({page}) => {
  await startApp(page);

  expect(await values(page,'countryFilter')).toEqual(['','Australia','Spain']);
  await page.selectOption('#countryFilter','Spain');
  expect(await values(page,'regionFilter')).toEqual(['','Andalusia','Balearic Islands']);
  expect(await values(page,'regionFilter')).not.toContain('Victoria');

  await page.selectOption('#regionFilter','Andalusia');
  expect(await values(page,'cityFilter')).toEqual(['','Granada','Malaga']);
  expect(await values(page,'cityFilter')).not.toContain('Palma');

  expect(await values(page,'typeFilter')).toEqual(['','Restaurant','Wine Bar']);
  await page.selectOption('#typeFilter','Restaurant');
  expect(await values(page,'cuisineFilter')).toEqual(['','Spanish']);

  await page.fill('#searchInput','Granada');
  await expect(page.locator('#resultCount')).toContainText('1 place');
  expect(await values(page,'typeFilter')).toEqual(['','Restaurant']);
  expect(await values(page,'cuisineFilter')).toEqual(['','Spanish']);

  await page.fill('#searchInput','');
  await page.selectOption('#countryFilter','Australia');
  await expect(page.locator('#regionFilter')).toHaveValue('');
  await expect(page.locator('#cityFilter')).toHaveValue('');
  expect(await values(page,'regionFilter')).toEqual(['','Victoria']);
});

test('Add/Edit uses native controls, resets cleanly, cascades, chips and safe close actions', async ({page}) => {
  await startApp(page);
  const initialCount = await page.evaluate(()=>window.PERS_TEST.getState().places.length);

  await page.click('#addPlaceBtn');
  await expect(page.locator('#placeDialog')).toHaveJSProperty('open', true);
  expect(await page.locator('#placeType').evaluate(el=>el.tagName)).toBe('SELECT');
  expect(await page.locator('#placeCuisine').evaluate(el=>el.tagName)).toBe('SELECT');

  await page.selectOption('#placeType','Restaurant');
  await page.selectOption('#placeCuisine','Spanish');
  await page.click('#placeCancelBtn');
  await expect(page.locator('#placeDialog')).toHaveJSProperty('open', false);
  expect(await page.evaluate(()=>window.PERS_TEST.getState().places.length)).toBe(initialCount);

  await page.click('#addPlaceBtn');
  await expect(page.locator('#placeType')).toHaveValue('');
  await expect(page.locator('#placeCuisine')).toHaveValue('');

  await page.selectOption('#placeCountry','Spain');
  await expect.poll(async()=>await values(page,'placeRegion')).toContain('Andalusia');
  await expect(page.locator('#placeRegion')).toBeEnabled();
  await page.selectOption('#placeRegion','Andalusia');
  await expect.poll(async()=>await values(page,'placeCity')).toContain('Granada');
  await expect(page.locator('#placeCity')).toBeEnabled();

  await page.selectOption('#placeMealsPicker','Lunch');
  await expect(page.locator('#placeMealsChips')).toContainText('Lunch');
  await expect(page.locator('#placeMeals')).toHaveValue('Lunch');
  await page.locator('#placeMealsChips [data-multi-remove="placeMeals"]').click();
  await expect(page.locator('#placeMeals')).toHaveValue('');

  await page.click('#placeCloseBtn');
  await expect(page.locator('#placeDialog')).toHaveJSProperty('open', false);
  expect(await page.evaluate(()=>window.PERS_TEST.getState().places.length)).toBe(initialCount);

  await page.click('#addPlaceBtn');
  await page.fill('#placeName','New Granada Venue');
  await page.selectOption('#placeType','Restaurant');
  await page.selectOption('#placeCuisine','Spanish');
  await page.selectOption('#placeCountry','Spain');
  await expect.poll(async()=>await values(page,'placeRegion')).toContain('Andalusia');
  await page.selectOption('#placeRegion','Andalusia');
  await expect.poll(async()=>await values(page,'placeCity')).toContain('Granada');
  await page.selectOption('#placeCity','Granada');
  await page.selectOption('#placeMealsPicker','Dinner');
  await page.click('#savePlaceBtn');
  await expect(page.locator('#placeDialog')).toHaveJSProperty('open', false);

  const saved = await page.evaluate(()=>window.PERS_TEST.getState().places.find(p=>p.name==='New Granada Venue'));
  expect(saved).toMatchObject({placeType:'Restaurant',cuisine:'Spanish',country:'Spain',stateRegion:'Andalusia',city:'Granada'});
  expect(saved.mealTypes).toContain('Dinner');

  await page.locator(`[data-edit="${saved.id}"]`).click();
  await expect(page.locator('#placeType')).toHaveValue('Restaurant');
  await expect(page.locator('#placeCuisine')).toHaveValue('Spanish');
  await expect(page.locator('#placeCountry')).toHaveValue('Spain');
  await expect(page.locator('#placeRegion')).toHaveValue('Andalusia');
  await expect(page.locator('#placeCity')).toHaveValue('Granada');
  await expect(page.locator('#placeMeals')).toHaveValue('Dinner');
});
