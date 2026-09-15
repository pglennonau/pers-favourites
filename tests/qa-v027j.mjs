import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const app = read('app.js');
const index = read('index.html');
const fix = read('v027j.js');
const config = read('config.js');
const sw = read('sw.js');
const version = JSON.parse(read('version.json'));

const requiredIds = [
  'countryFilter','regionFilter','cityFilter','typeFilter','cuisineFilter',
  'placeDialog','placeForm','placeCountry','placeRegion','placeCity',
  'placeType','placeCuisine','placeMeals','placeGreatFor','placeFeatures',
  'placeDietary','placeTags','addPlaceBtn','clearSearchBtn','activeChips'
];
for (const id of requiredIds) assert.match(index, new RegExp(`id=["']${id}["']`), `index.html is missing #${id}`);

assert.equal(version.release, 'v027j');
assert.equal(version.version, '0.27.10');
assert.match(config, /version:\s*["']0\.27\.10["']/);
assert.match(config, /v027j\.js\?v=0\.27\.10/);
assert.match(sw, /pers-favourites-v027j-shell-v1/);
assert.match(sw, /\.\/v027j\.js/);

// Syntax-sensitive implementation markers. `node --check` in the workflow performs the actual parser check.
assert.match(fix, /const VERSION='0\.27\.10'/);
assert.match(fix, /replaceInputWithSelect\('placeCountry'\)/);
assert.match(fix, /replaceInputWithSelect\('placeRegion'\)/);
assert.match(fix, /replaceInputWithSelect\('placeCity'\)/);
assert.match(fix, /replaceInputWithSelect\('placeType'\)/);
assert.match(fix, /replaceInputWithSelect\('placeCuisine'\)/);
assert.match(fix, /b\.type='button'/, 'Cancel/close buttons must be forced to non-submit buttons');
assert.match(fix, /filters\.region='';filters\.city=''/, 'Country changes must clear region and city');
assert.match(fix, /if\(key==='region'\)filters\.city=''/, 'Region changes must clear city');
assert.match(fix, /ensureGeoStates\(currentCountry\)/);
assert.match(fix, /ensureGeoCities\(currentCountry,currentRegion\)/);
assert.match(fix, /placeMealsPicker|\$\{id\}Picker/);
assert.match(fix, /refreshAllMultiEditors/);
assert.match(fix, /search\.oninput=.*rebuildFilters/);
assert.match(fix, /PERS_QA_027J/);

// Verify the base app still exposes the functions/fields the corrective layer deliberately wraps.
for (const symbol of ['openPlaceEditor','useOnlinePlace','populateFilterOptions','quickFilter','runAskPers','archivePlace','restorePlace','deleteForever']) {
  assert.match(app, new RegExp(`function\\s+${symbol}\\b|async\\s+function\\s+${symbol}\\b`), `Base app no longer exposes ${symbol}`);
}

// Pure cascade regression model: changing the parent must reduce valid child choices.
const sample = [
  {country:'Spain',region:'Andalusia',city:'Granada',type:'Restaurant',cuisine:'Spanish'},
  {country:'Spain',region:'Andalusia',city:'Malaga',type:'Wine Bar',cuisine:'Spanish'},
  {country:'Spain',region:'Balearic Islands',city:'Palma',type:'Restaurant',cuisine:'Mediterranean'},
  {country:'Australia',region:'Victoria',city:'Melbourne',type:'Restaurant',cuisine:'Italian'}
];
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const same = (a,b) => norm(a) === norm(b);
const unique = xs => [...new Set(xs)].sort();

const statesFor = country => unique(sample.filter(x => same(x.country,country)).map(x => x.region));
const citiesFor = (country,region) => unique(sample.filter(x => same(x.country,country) && same(x.region,region)).map(x => x.city));
assert.deepEqual(statesFor('Spain'), ['Andalusia','Balearic Islands']);
assert.deepEqual(citiesFor('Spain','Andalusia'), ['Granada','Malaga']);
assert.deepEqual(citiesFor('Spain','Balearic Islands'), ['Palma']);
assert.deepEqual(statesFor('Australia'), ['Victoria']);
assert.deepEqual(citiesFor('Australia','Victoria'), ['Melbourne']);

const choicesAfter = filters => sample.filter(p =>
  (!filters.country || same(p.country,filters.country)) &&
  (!filters.region || same(p.region,filters.region)) &&
  (!filters.city || same(p.city,filters.city)) &&
  (!filters.type || p.type === filters.type) &&
  (!filters.cuisine || p.cuisine === filters.cuisine)
);
assert.equal(choicesAfter({country:'Spain'}).length, 3);
assert.equal(choicesAfter({country:'Spain',region:'Andalusia'}).length, 2);
assert.equal(choicesAfter({country:'Spain',region:'Andalusia',city:'Granada'}).length, 1);
assert.equal(choicesAfter({country:'Spain',type:'Restaurant'}).length, 2);
assert.equal(choicesAfter({country:'Spain',type:'Restaurant',cuisine:'Spanish'}).length, 1);

console.log('v027j regression QA passed');
