import fs from 'node:fs';

const source=fs.readFileSync('cloudflare/places-search-worker.js','utf8').replace('export default','const workerDefault =');
const api=new Function(source+`
return {
  googleUsageLimits, recordGoogleUsage, tripadvisorConfig, tripadvisorStatus,
  recordTripadvisorUsage, normaliseTripadvisorLocation
};`)();

const results=[];
const check=(name,ok,detail='')=>results.push({name,pass:!!ok,detail});
async function expectError(name,fn,contains){
  try{await fn();check(name,false,'no error thrown');}
  catch(e){check(name,String(e?.message||e).includes(contains),String(e?.message||e));}
}
function usageDb(count=0){
  let value=count;
  return {
    get count(){return value;},
    prepare(sql){
      return {
        args:[],
        bind(...args){this.args=args;return this;},
        async run(){if(sql.includes('insert into tripadvisor_usage'))value++;return {};},
        async first(){
          if(sql.includes('select call_count,updated_at from tripadvisor_usage'))return {call_count:value,updated_at:'2026-09-20T00:00:00Z'};
          if(sql.includes('select call_count from google_places_usage'))return {call_count:0};
          return null;
        },
        async all(){
          if(sql.includes('pragma table_info(google_places_usage)'))return {results:[{name:'bucket'},{name:'call_count'},{name:'updated_at'}]};
          return {results:[]};
        }
      };
    },
    async batch(){return [];}
  };
}

const demo=api.googleUsageLimits({GOOGLE_PLACES_MODE:'demo'});
check('Google demo limits',demo.configured&&demo.minuteLimit===10&&demo.dayLimit===100,demo);

const prodMissing=api.googleUsageLimits({GOOGLE_PLACES_MODE:'production'});
check('Google production requires explicit limits',prodMissing.configured===false,prodMissing);

const prod=api.googleUsageLimits({
  GOOGLE_PLACES_MODE:'production',
  GOOGLE_PLACES_PRODUCTION_MINUTE_LIMIT:'60',
  GOOGLE_PLACES_PRODUCTION_DAILY_LIMIT:'2000'
});
check('Google production configured limits',prod.configured&&prod.minuteLimit===60&&prod.dayLimit===2000,prod);

await expectError('Google blocks without USAGE_DB',()=>api.recordGoogleUsage({GOOGLE_PLACES_MODE:'demo'}),'USAGE_DB');
await expectError('Google production blocks without explicit limits',()=>api.recordGoogleUsage({GOOGLE_PLACES_MODE:'production',USAGE_DB:usageDb()}),'production limits are not configured');

const taBase={TRIPADVISOR_API_KEY:'test-key',TRIPADVISOR_ENABLED:'true',TRIPADVISOR_FREE_ALLOWANCE:'100'};
const taConfig=api.tripadvisorConfig({TRIPADVISOR_API_KEY:'test-key',TRIPADVISOR_ENABLED:'true'});
check('TripAdvisor missing allowance defaults to zero',taConfig.allowance===0,taConfig);

for(const [count,state] of [[49,'active'],[50,'warning'],[95,'paused']]){
  const status=await api.tripadvisorStatus({...taBase,USAGE_DB:usageDb(count)});
  check(`TripAdvisor ${count}/100 is ${state}`,status.state===state,status);
}
const paidStatus=await api.tripadvisorStatus({
  ...taBase,
  TRIPADVISOR_OWNER_PAID_APPROVED:'true',
  TRIPADVISOR_ALLOW_PAID:'true',
  USAGE_DB:usageDb(95)
});
check('TripAdvisor above cutoff is active only with both paid gates',paidStatus.state==='active'&&paidStatus.paidUsageAuthorized===true,paidStatus);

await expectError('TripAdvisor blocks without USAGE_DB',()=>api.recordTripadvisorUsage(taBase),'USAGE_DB');
await expectError('TripAdvisor blocks missing allowance',()=>api.recordTripadvisorUsage({TRIPADVISOR_API_KEY:'test-key',TRIPADVISOR_ENABLED:'true',USAGE_DB:usageDb()}),'allowance is not configured');
await expectError('TripAdvisor blocks at cutoff',()=>api.recordTripadvisorUsage({...taBase,USAGE_DB:usageDb(95)}),'95%');

const belowDb=usageDb(94);
const below=await api.recordTripadvisorUsage({...taBase,USAGE_DB:belowDb});
check('TripAdvisor call below cutoff increments usage',below.count===95&&belowDb.count===95,{returned:below.count,stored:belowDb.count});

const sample=api.normaliseTripadvisorLocation({
  tripadvisor_id:188729,
  names:[{locale:'en-US',value:'Le Bristol Paris'}],
  addresses:[{address1:'112 Rue du Faubourg Saint Honore',city:'Paris',country:'France'}],
  coordinates:{latitude:48.871,longitude:2.318},
  traveler_ratings:{overall:{rating:4.9,count:2455,icon_url:'https://example.invalid/bubble.png'}},
  urls:{tripadvisor:'https://www.tripadvisor.com/example',official:'https://example.invalid'},
  categories:[{value:'HOTEL'}]
});
check('TripAdvisor v1 parser reads id/name/rating/count',sample.id==='188729'&&sample.name==='Le Bristol Paris'&&sample.rating===4.9&&sample.ratingCount===2455,sample);

const failed=results.filter(x=>!x.pass);
const report={passed:results.length-failed.length,failed:failed.length,results};
fs.writeFileSync('worker-unit-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
