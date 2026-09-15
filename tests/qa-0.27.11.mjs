import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const app = read('app.js');
const index = read('index.html');
const config = read('config.js');
const example = read('config.example.js');
const sw = read('sw.js');
const version = JSON.parse(read('version.json'));

assert.equal(version.version, '0.27.11');
assert.equal(version.release, '0.27.11');
assert.match(config, /version:\s*["']0\.27\.11["']/);
assert.match(example, /version:\s*["']0\.27\.11["']/);
assert.doesNotMatch(config, /v027j\.js|data-pers-v027j/);
assert.doesNotMatch(example, /v027j\.js|data-pers-v027j/);
assert.match(sw, /pers-favourites-0\.27\.11-shell-v1/);
assert.doesNotMatch(sw, /v027j\.js/);

for (const id of [
  'countryFilter','regionFilter','cityFilter','typeFilter','cuisineFilter',
  'placeDialog','placeForm','placeCloseBtn','placeCancelBtn','placeCountry',
  'placeRegion','placeCity','placeType','placeCuisine','placeMeals',
  'placeMealsPicker','placeMealsChips','placeGreatForPicker','placeFeaturesPicker',
  'placeDietaryPicker','placeTagsPicker','addPlaceBtn','searchInput','activeChips'
]) {
  assert.match(index, new RegExp(`id=["']${id}["']`), `index.html is missing #${id}`);
}

for (const id of ['placeType','placeCuisine','placeCountry','placeRegion','placeCity']) {
  assert.match(index, new RegExp(`<select[^>]*id=["']${id}["']`), `#${id} must be a native select in base HTML`);
}
assert.match(index, /id="placeCloseBtn"[^>]*type="button"/);
assert.match(index, /id="placeCancelBtn"[^>]*type="button"/);

for (const marker of [
  'PLACE_TYPES','CUISINES','MULTI_EDITOR_FIELDS','rowsForFilterChoice',
  'populateFilterOptions','hydrateEditorGeography','refreshEditorTaxonomy',
  'refreshAllMultiEditors','closePlaceEditor','seedCatalogue'
]) {
  assert.match(app, new RegExp(`\\b${marker}\\b`), `app.js missing ${marker}`);
}
assert.doesNotMatch(app, /PERS_QA_027J|replaceInputWithSelect|data-pers-v027j/);
assert.match(app, /filters\.region\s*=\s*''/);
assert.match(app, /filters\.city\s*=\s*''/);
assert.match(app, /placeCloseBtn/);
assert.match(app, /placeCancelBtn/);

const sample = [
  {country:'Spain',region:'Andalusia',city:'Granada',type:'Restaurant',cuisine:'Spanish'},
  {country:'Spain',region:'Andalusia',city:'Malaga',type:'Wine Bar',cuisine:'Spanish'},
  {country:'Spain',region:'Balearic Islands',city:'Palma',type:'Restaurant',cuisine:'Mediterranean'},
  {country:'Australia',region:'Victoria',city:'Melbourne',type:'Restaurant',cuisine:'Italian'}
];
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const same = (a,b) => fold(a) === fold(b);
const unique = xs => [...new Set(xs)].sort();
const regions = country => unique(sample.filter(x=>same(x.country,country)).map(x=>x.region));
const cities = (country,region) => unique(sample.filter(x=>same(x.country,country)&&same(x.region,region)).map(x=>x.city));
assert.deepEqual(regions('Spain'), ['Andalusia','Balearic Islands']);
assert.deepEqual(cities('Spain','Andalusia'), ['Granada','Malaga']);
assert.deepEqual(regions('Australia'), ['Victoria']);

const choices = ({country='',region='',type='',cuisine=''}) => sample.filter(x =>
  (!country || same(x.country,country)) &&
  (!region || same(x.region,region)) &&
  (!type || x.type===type) &&
  (!cuisine || x.cuisine===cuisine)
);
assert.equal(choices({country:'Spain'}).length, 3);
assert.equal(choices({country:'Spain',region:'Andalusia'}).length, 2);
assert.equal(choices({country:'Spain',region:'Andalusia',type:'Restaurant'}).length, 1);
assert.equal(choices({country:'Spain',type:'Restaurant',cuisine:'Spanish'}).length, 1);

console.log('0.27.11 structural/regression QA passed');
