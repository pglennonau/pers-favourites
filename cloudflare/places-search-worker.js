function cors(origin, allowed) {
  const ok = !allowed || allowed === '*' || origin === allowed;
  return {
    'Access-Control-Allow-Origin': ok ? (allowed || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function clean(v) { return String(v ?? '').trim(); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function googleMode(env) {
  return clean(env.GOOGLE_PLACES_MODE).toLowerCase() === 'production' ? 'production' : 'demo';
}
function googleUsageLimits(env) {
  const mode = googleMode(env);
  if (mode === 'demo') return { mode, minuteLimit: 10, dayLimit: 100, configured: true };
  const minuteLimit = Math.max(0, Math.floor(envNumber(env, 'GOOGLE_PLACES_PRODUCTION_MINUTE_LIMIT', 0)));
  const dayLimit = Math.max(0, Math.floor(envNumber(env, 'GOOGLE_PLACES_PRODUCTION_DAILY_LIMIT', 0)));
  return { mode, minuteLimit, dayLimit, configured: minuteLimit > 0 && dayLimit > 0 };
}
async function recordGoogleUsage(env) {
  const db = env.USAGE_DB;
  if (!db) return;
  const limits = googleUsageLimits(env);
  const mode = limits.mode;
  if (!limits.configured) throw new Error('Google Places production limits are not configured. Set GOOGLE_PLACES_PRODUCTION_MINUTE_LIMIT and GOOGLE_PLACES_PRODUCTION_DAILY_LIMIT before using production mode.');
  await db.prepare('create table if not exists google_places_usage (bucket text primary key, call_count integer not null default 0, updated_at text not null)').run();
  const info = await db.prepare('pragma table_info(google_places_usage)').all();
  const cols = new Set((info?.results || []).map(x => x.name));
  const now = new Date(), minute = now.toISOString().slice(0, 16), day = now.toISOString().slice(0, 10);

  // Compatibility with the first demo D1 schema used before call_count/bucket were introduced.
  if (!cols.has('bucket') && cols.has('day_key') && cols.has('day_count') && cols.has('minute_key') && cols.has('minute_count')) {
    const row = await db.prepare('select id,day_key,day_count,minute_key,minute_count from google_places_usage order by id limit 1').first();
    const dayCount = row?.day_key === day ? (+row.day_count || 0) : 0;
    const minuteCount = row?.minute_key === minute ? (+row.minute_count || 0) : 0;
    if (minuteCount >= limits.minuteLimit) throw new Error(`Google Places ${mode} minute limit reached. Please retry shortly.`);
    if (dayCount >= limits.dayLimit) throw new Error(`Google Places ${mode} daily limit reached. Please retry after the configured daily window resets.`);
    if (row?.id != null) {
      await db.prepare('update google_places_usage set day_key=?,day_count=?,minute_key=?,minute_count=?,updated_at=? where id=?')
        .bind(day, dayCount + 1, minute, minuteCount + 1, now.toISOString(), row.id).run();
    } else {
      await db.prepare('insert into google_places_usage(day_key,day_count,minute_key,minute_count,updated_at) values(?,?,?,?,?)')
        .bind(day, 1, minute, 1, now.toISOString()).run();
    }
    return;
  }

  if (!cols.has('bucket') || !cols.has('call_count')) throw new Error('Google Places usage database schema is not recognised.');
  const minuteKey = `minute:${minute}`, dayKey = `day:${day}`;
  const [m, d] = await Promise.all([
    db.prepare('select call_count from google_places_usage where bucket=?').bind(minuteKey).first(),
    db.prepare('select call_count from google_places_usage where bucket=?').bind(dayKey).first()
  ]);
  if ((m?.call_count || 0) >= limits.minuteLimit) throw new Error(`Google Places ${mode} minute limit reached. Please retry shortly.`);
  if ((d?.call_count || 0) >= limits.dayLimit) throw new Error(`Google Places ${mode} daily limit reached. Please retry after the configured daily window resets.`);
  await db.batch([
    db.prepare('insert into google_places_usage(bucket,call_count,updated_at) values(?,1,?) on conflict(bucket) do update set call_count=call_count+1,updated_at=excluded.updated_at').bind(minuteKey, now.toISOString()),
    db.prepare('insert into google_places_usage(bucket,call_count,updated_at) values(?,1,?) on conflict(bucket) do update set call_count=call_count+1,updated_at=excluded.updated_at').bind(dayKey, now.toISOString()),
    db.prepare("delete from google_places_usage where updated_at < datetime('now','-35 days')")
  ]);
}
function rectangle(lat, lng, radiusKm) {
  const dLat = radiusKm / 111.32;
  const cos = Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const dLng = radiusKm / (111.32 * cos);
  return {
    low: { latitude: clamp(lat - dLat, -90, 90), longitude: clamp(lng - dLng, -180, 180) },
    high:{ latitude: clamp(lat + dLat, -90, 90), longitude: clamp(lng + dLng, -180, 180) }
  };
}
function component(place, type) {
  const x = (place.addressComponents || []).find(c => (c.types || []).includes(type));
  return x?.longText || x?.shortText || '';
}
function normalisePlace(p) {
  const country = component(p, 'country');
  const stateRegion = component(p, 'administrative_area_level_1') || component(p, 'administrative_area_level_2');
  const city = component(p, 'locality') || component(p, 'postal_town') || component(p, 'administrative_area_level_2');
  const suburb = component(p, 'sublocality_level_1') || component(p, 'sublocality') || component(p, 'neighborhood');
  const photo = (p.photos || [])[0] || {};
  return {
    id: p.id || '', name: p.displayName?.text || '', address: p.formattedAddress || '',
    lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
    placeType: p.primaryTypeDisplayName?.text || p.primaryType || (p.types || [])[0] || '',
    primaryType: p.primaryType || '', country, stateRegion, city, suburb,
    website: p.websiteUri || '', phone: p.internationalPhoneNumber || '', googleMapsUrl: p.googleMapsUri || '',
    rating: Number(p.rating) || 0, userRatingCount: Number(p.userRatingCount) || 0,
    openNow: p.currentOpeningHours?.openNow === true, weekdayDescriptions: Array.isArray(p.currentOpeningHours?.weekdayDescriptions) ? p.currentOpeningHours.weekdayDescriptions : [],
    photoRef: photo.name || '', photoAttribution: Array.isArray(photo.authorAttributions) ? photo.authorAttributions.map(x => ({ displayName: x.displayName || '', uri: x.uri || '', photoUri: x.photoUri || '' })) : []
  };
}
async function textSearchWithKey(env, apiKey, textQuery, location, context, widen, filters = {}) {
  const body = { textQuery, pageSize: 10, languageCode: 'en' };
  if (filters?.openNow === true) body.openNow = true;
  if (location && Number.isFinite(+location.lat) && Number.isFinite(+location.lng)) {
    const lat = +location.lat, lng = +location.lng;
    if (widen) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
    else body.locationRestriction = { rectangle: rectangle(lat, lng, 30) };
  } else {
    const label = [context?.city, context?.region, context?.country].map(clean).filter(Boolean).join(', ');
    if (!label) throw new Error('Current location is unavailable and no city/region fallback is known.');
    body.textQuery = `${textQuery}, ${label}`;
  }
  await recordGoogleUsage(env);
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.primaryTypeDisplayName,places.types,places.websiteUri,places.internationalPhoneNumber,places.googleMapsUri,places.addressComponents,places.photos,places.rating,places.userRatingCount,places.currentOpeningHours'
    },
    body: JSON.stringify(body)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error?.message || `Google Places request failed (${r.status}).`);
  return (json.places || []).map(normalisePlace);
}

async function photoUriWithKey(env, apiKey, photoRef, maxWidthPx = 1200) {
  const ref = clean(photoRef);
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(ref)) throw new Error('A valid Google Places photo reference is required.');
  const width = Math.round(clamp(+maxWidthPx || 1200, 400, 2400));
  const u = new URL(`https://places.googleapis.com/v1/${ref}/media`);
  u.searchParams.set('maxWidthPx', String(width));
  u.searchParams.set('skipHttpRedirect', 'true');
  await recordGoogleUsage(env);
  const r = await fetch(u.toString(), { headers: { 'X-Goog-Api-Key': apiKey } });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.photoUri) throw new Error(json?.error?.message || `Google Places photo request failed (${r.status}).`);
  return json.photoUri;
}

async function readGoogleUsageStatus(env){
  const db=env.USAGE_DB;
  if(!db)return {tracking:false,callsToday:0};
  await db.prepare('create table if not exists google_places_usage (bucket text primary key, call_count integer not null default 0, updated_at text not null)').run();
  const info=await db.prepare('pragma table_info(google_places_usage)').all();
  const cols=new Set((info?.results||[]).map(x=>x.name));
  const day=new Date().toISOString().slice(0,10);
  if(!cols.has('bucket')&&cols.has('day_key')&&cols.has('day_count')){
    const row=await db.prepare('select day_key,day_count from google_places_usage order by id limit 1').first();
    return {tracking:true,callsToday:row?.day_key===day?(+row.day_count||0):0};
  }
  if(cols.has('bucket')&&cols.has('call_count')){
    const row=await db.prepare('select call_count from google_places_usage where bucket=?').bind(`day:${day}`).first();
    return {tracking:true,callsToday:+row?.call_count||0};
  }
  return {tracking:false,callsToday:0};
}
function envNumber(env, name, fallback) {
  const raw = clean(env[name]);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function envBool(env, name, fallback = false) {
  const v = clean(env[name]).toLowerCase();
  if (!v) return fallback;
  return ['1','true','yes','on','enabled'].includes(v);
}
function tripadvisorPeriodKey(env, now = new Date()) {
  const period = clean(env.TRIPADVISOR_ALLOWANCE_PERIOD).toLowerCase() || 'one-time';
  if (period === 'monthly') return `month:${now.toISOString().slice(0,7)}`;
  if (period === 'daily') return `day:${now.toISOString().slice(0,10)}`;
  if (period === 'custom') return `custom:${clean(env.TRIPADVISOR_PERIOD_ID) || 'current'}`;
  return 'one-time';
}
function tripadvisorConfig(env) {
  const allowance = Math.max(0, Math.floor(envNumber(env,'TRIPADVISOR_FREE_ALLOWANCE',0)));
  const warningPercent = clamp(envNumber(env,'TRIPADVISOR_WARNING_PERCENT',50),1,99);
  const cutoffPercent = clamp(envNumber(env,'TRIPADVISOR_CUTOFF_PERCENT',95),1,100);
  const ownerPaidApproved = envBool(env,'TRIPADVISOR_OWNER_PAID_APPROVED',false);
  const administratorPaidEnabled = envBool(env,'TRIPADVISOR_ALLOW_PAID',false);
  return {
    connected: !!clean(env.TRIPADVISOR_API_KEY),
    enabled: envBool(env,'TRIPADVISOR_ENABLED',false),
    ownerPaidApproved,
    administratorPaidEnabled,
    paidUsageAuthorized: ownerPaidApproved && administratorPaidEnabled,
    allowance,
    allowancePeriod: clean(env.TRIPADVISOR_ALLOWANCE_PERIOD).toLowerCase() || 'one-time',
    warningPercent,
    cutoffPercent,
    manageBillingUrl: clean(env.TRIPADVISOR_BILLING_URL)
  };
}
async function readTripadvisorUsage(env) {
  if (!env.USAGE_DB) return { count: 0, periodKey: tripadvisorPeriodKey(env), tracking: false };
  const key = tripadvisorPeriodKey(env);
  await env.USAGE_DB.prepare('create table if not exists tripadvisor_usage (bucket text primary key, call_count integer not null default 0, updated_at text not null)').run();
  const row = await env.USAGE_DB.prepare('select call_count,updated_at from tripadvisor_usage where bucket=?').bind(key).first();
  return { count: Number(row?.call_count) || 0, periodKey: key, tracking: true, updatedAt: row?.updated_at || '' };
}
async function tripadvisorStatus(env) {
  const cfg = tripadvisorConfig(env), usage = await readTripadvisorUsage(env);
  const warningAt = cfg.allowance ? Math.floor(cfg.allowance * cfg.warningPercent / 100) : 0;
  const cutoffAt = cfg.allowance ? Math.floor(cfg.allowance * cfg.cutoffPercent / 100) : 0;
  const percent = cfg.allowance ? Math.min(999, Math.round((usage.count / cfg.allowance) * 1000) / 10) : 0;
  const paused = !cfg.connected || !cfg.enabled || (!cfg.paidUsageAuthorized && (cfg.allowance <= 0 || (cutoffAt > 0 && usage.count >= cutoffAt)));
  return { ...cfg, ...usage, warningAt, cutoffAt, percent, paused,
    state: paused ? 'paused' : (!cfg.paidUsageAuthorized && warningAt > 0 && usage.count >= warningAt ? 'warning' : 'active')
  };
}
async function recordTripadvisorUsage(env) {
  if (!env.USAGE_DB) throw new Error('TripAdvisor API calls are blocked because USAGE_DB is not configured for cost control.');
  const status = await tripadvisorStatus(env);
  if (!status.connected) throw new Error('TRIPADVISOR_API_KEY secret is not configured.');
  if (!status.enabled) throw new Error('TripAdvisor API access is disabled by the System Administrator.');
  if (!status.paidUsageAuthorized && status.allowance <= 0) throw new Error('TripAdvisor free allowance is not configured. Set TRIPADVISOR_FREE_ALLOWANCE before enabling API calls.');
  if (!status.paidUsageAuthorized && status.cutoffAt > 0 && status.count >= status.cutoffAt) {
    throw new Error(`TripAdvisor API paused at the ${status.cutoffPercent}% free-allowance cutoff (${status.count}/${status.allowance}).`);
  }
  const now = new Date().toISOString();
  await env.USAGE_DB.prepare('insert into tripadvisor_usage(bucket,call_count,updated_at) values(?,1,?) on conflict(bucket) do update set call_count=call_count+1,updated_at=excluded.updated_at')
    .bind(status.periodKey, now).run();
  return { ...status, count: status.count + 1 };
}
function firstText(v) {
  if (typeof v === 'string' || typeof v === 'number') return clean(v);
  if (Array.isArray(v)) {
    for (const x of v) { const t = firstText(x); if (t) return t; }
    return '';
  }
  if (v && typeof v === 'object') {
    for (const k of ['display_name','displayName','name','text','value','localized','default','en-US','en']) {
      const t = firstText(v[k]); if (t) return t;
    }
  }
  return '';
}
function terraRows(j) {
  if (Array.isArray(j)) return j;
  for (const k of ['data','locations','results','items','content']) if (Array.isArray(j?.[k])) return j[k];
  return [];
}
function terraPhotoUrl(v) {
  if (!v) return '';
  if (typeof v === 'string') return /^https?:\/\//i.test(v) ? v : '';
  if (Array.isArray(v)) {
    for (const x of v) { const u = terraPhotoUrl(x); if (u) return u; }
    return '';
  }
  for (const k of ['url','uri','photo_url','photoUrl','image_url','imageUrl','src','original','large','medium','small','urls','images','image','cdn']) {
    const u = terraPhotoUrl(v[k]); if (u) return u;
  }
  return '';
}
function firstAddressObject(v) {
  if (Array.isArray(v)) return v.find(x => x && typeof x === 'object') || {};
  return v && typeof v === 'object' ? v : {};
}
function addressText(v) {
  const a = firstAddressObject(v);
  const direct = firstText(a.formatted_address || a.formattedAddress || a.address_string || a.addressString || a.full_address || a.fullAddress);
  if (direct) return direct;
  return [
    firstText(a.address1 || a.address_line_1 || a.addressLine1 || a.street),
    firstText(a.address2 || a.address_line_2 || a.addressLine2),
    firstText(a.city || a.town || a.locality),
    firstText(a.state || a.region || a.province),
    firstText(a.postal_code || a.postalCode || a.zip),
    firstText(a.country)
  ].filter(Boolean).join(', ');
}
function addressPart(v, keys=[]) {
  const a = firstAddressObject(v);
  for (const k of keys) {
    const t = firstText(a?.[k]);
    if (t) return t;
  }
  return '';
}
function normaliseTripadvisorLocation(raw) {
  const x = raw?.location && raw.location?.tripadvisor_id ? raw.location : raw;
  const coords = x?.coordinates || x?.geo || {};
  const addressObj = x?.addresses || x?.address || {};
  const traveler = x?.traveler_ratings || x?.travelerRatings || {};
  const overall = traveler?.overall || traveler || {};
  const rating = Number(overall?.rating ?? overall?.value ?? x?.rating ?? x?.bubble_rating ?? x?.bubbleRating) || 0;
  const ratingCount = Number(overall?.count ?? overall?.review_count ?? overall?.reviewCount ?? x?.review_count ?? x?.reviewCount ?? x?.num_reviews ?? x?.numReviews) || 0;
  const urls = x?.urls || {};
  const category = firstText(x?.categories || x?.category || x?.type);
  const photo = terraPhotoUrl(x?.representative_photo || x?.representativePhoto || x?.photos);
  return {
    id: firstText(x?.tripadvisor_id || x?.tripadvisorId || x?.location_id || x?.locationId || x?.id),
    name: firstText(x?.names || x?.name || x?.display_name || x?.displayName),
    address: addressText(addressObj),
    lat: Number(coords?.latitude ?? coords?.lat ?? x?.latitude ?? x?.lat),
    lng: Number(coords?.longitude ?? coords?.lng ?? coords?.lon ?? x?.longitude ?? x?.lng ?? x?.lon),
    placeType: category,
    country: addressPart(addressObj,['country','country_name','countryName']) || firstText(x?.country),
    stateRegion: addressPart(addressObj,['state','region','province','state_name','region_name']) || firstText(x?.state || x?.region),
    city: addressPart(addressObj,['city','town','locality','city_name']) || firstText(x?.city || x?.town),
    suburb: addressPart(addressObj,['neighborhood','neighbourhood','suburb']) || firstText(x?.neighborhood || x?.suburb),
    rating, ratingCount,
    ratingIconUrl: terraPhotoUrl(overall?.icon_url || overall?.iconUrl),
    url: firstText(urls?.tripadvisor || urls?.tripadvisor_url || urls?.tripadvisorUrl || urls?.web || urls?.web_url || x?.web_url || x?.webUrl || x?.url),
    website: firstText(urls?.official || urls?.website || urls?.official_website || x?.website),
    phone: firstText(x?.phone_numbers || x?.phoneNumbers || x?.phone),
    photoUri: photo
  };
}
async function tripadvisorSearchWithKey(env, query, context, filters = {}) {
  await recordTripadvisorUsage(env);
  const u = new URL('https://terra.tripadvisor.com/api/locations/search');
  u.searchParams.set('query', clean(query));
  u.searchParams.set('size', '10');
  u.searchParams.append('locale', 'en-US');
  const geo = clean(context?.city || context?.region || context?.country);
  if (geo) u.searchParams.set('geo_name', geo);
  const type = clean(filters?.type).toLowerCase();
  if (type.includes('restaurant') || type.includes('cafe') || type.includes('bar') || type.includes('food')) u.searchParams.set('category','RESTAURANT');
  else if (type.includes('hotel') || type.includes('accommodation')) u.searchParams.set('category','HOTEL');
  else if (type.includes('attraction')) u.searchParams.set('category','ATTRACTION');
  const r = await fetch(u.toString(), { headers: { 'Accept':'application/json', 'X-API-Key': clean(env.TRIPADVISOR_API_KEY) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.detail || `TripAdvisor Terra request failed (${r.status}).`);
  return terraRows(j).map(normaliseTripadvisorLocation).filter(x => x.id || x.name);
}
async function tripadvisorPhotoWithKey(env, locationId) {
  const id = clean(locationId);
  if (!/^\d+$/.test(id)) throw new Error('A valid TripAdvisor location ID is required.');
  await recordTripadvisorUsage(env);
  const u = new URL(`https://terra.tripadvisor.com/api/locations/${id}/photos`);
  u.searchParams.set('size','1');u.searchParams.append('locale','en-US');
  const r = await fetch(u.toString(), { headers: { 'Accept':'application/json', 'X-API-Key': clean(env.TRIPADVISOR_API_KEY) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.detail || `TripAdvisor photo request failed (${r.status}).`);
  const row = terraRows(j)[0] || j?.photo || j?.data || null;
  const photoUri = terraPhotoUrl(row);
  return { photoUri, attribution: photoUri ? 'Tripadvisor' : '' };
}

async function handleAdminGoogleConnection(request, env, headers) {
  return new Response(JSON.stringify({
    error: 'Browser-based Google API key management is disabled in v0.27.23. Manage GOOGLE_PLACES_API_KEY and GOOGLE_PLACES_MODE as Cloudflare Worker secrets in the Cloudflare dashboard.'
  }), { status: 403, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    const headers = cors(origin, allowed);
    if (allowed !== '*' && origin && origin !== allowed) return new Response(JSON.stringify({ error: 'Origin is not allowed.' }), { status: 403, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required.' }), { status: 405, headers });
    const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
    try {
      const input = await request.json().catch(() => ({}));
      if (path.endsWith('/admin/google-connection')) return await handleAdminGoogleConnection(request, env, headers);
      if (path.endsWith('/services/status') || path.endsWith('/tripadvisor/status')) {
        const ta = await tripadvisorStatus(env);
        const gu = await readGoogleUsageStatus(env);
        return new Response(JSON.stringify({
          provider:'pers-services',
          google:{ connected:!!clean(env.GOOGLE_PLACES_API_KEY), ...googleUsageLimits(env), ...gu },
          tripadvisor:ta
        }), { status:200, headers });
      }
      if (path.endsWith('/tripadvisor-search')) {
        const query = clean(input?.query);
        if (!query) return new Response(JSON.stringify({ error:'A venue query is required.' }), { status:400, headers });
        const places = await tripadvisorSearchWithKey(env, query, input?.context || {}, input?.filters || {});
        const status = await tripadvisorStatus(env);
        return new Response(JSON.stringify({ provider:'tripadvisor', places, usage:status }), { status:200, headers });
      }
      if (path.endsWith('/tripadvisor-photo')) {
        const photo = await tripadvisorPhotoWithKey(env, input?.locationId);
        const status = await tripadvisorStatus(env);
        return new Response(JSON.stringify({ provider:'tripadvisor', ...photo, usage:status }), { status:200, headers });
      }

      if (!env.GOOGLE_PLACES_API_KEY) return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY secret is not configured.' }), { status: 500, headers });
      if (path.endsWith('/photo') || path.endsWith('/places-photo')) {
        const photoUri = await photoUriWithKey(env, env.GOOGLE_PLACES_API_KEY, input?.photoRef, input?.maxWidthPx);
        return new Response(JSON.stringify({ provider: 'google-places', photoUri }), { status: 200, headers });
      }
      const query = clean(input?.query); const normal = clean(input?.normalizedQuery);
      if (!query) return new Response(JSON.stringify({ error: 'A venue query is required.' }), { status: 400, headers });
      let places = await textSearchWithKey(env, env.GOOGLE_PLACES_API_KEY, query, input?.location, input?.context, !!input?.widen, input?.filters || {});
      if (normal && normal.toLowerCase() !== query.toLowerCase()) {
        const retry = await textSearchWithKey(env, env.GOOGLE_PLACES_API_KEY, normal, input?.location, input?.context, !!input?.widen, input?.filters || {});
        const seen = new Set(places.map(x => x.id || `${x.name}|${x.address}`));
        for (const x of retry) { const k = x.id || `${x.name}|${x.address}`; if (!seen.has(k)) { seen.add(k); places.push(x); } }
      }
      return new Response(JSON.stringify({ provider: 'google-places', places: places.slice(0, 15), mode:googleMode(env) }), { status: 200, headers });
    } catch (e) {
      const msg = e?.message || 'Places service failed.';
      const status = /permission|required|verified|sign-in|disabled/i.test(msg) ? 403 : (/paused|allowance|limit|quota/i.test(msg) ? 429 : 500);
      return new Response(JSON.stringify({ error: msg }), { status, headers });
    }
  }
};
