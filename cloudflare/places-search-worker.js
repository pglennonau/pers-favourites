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
async function recordGoogleUsage(env) {
  const db = env.USAGE_DB;
  if (!db) return;
  await db.prepare('create table if not exists google_places_usage (bucket text primary key, call_count integer not null default 0, updated_at text not null)').run();
  const info = await db.prepare('pragma table_info(google_places_usage)').all();
  const cols = new Set((info?.results || []).map(x => x.name));
  const now = new Date(), minute = now.toISOString().slice(0, 16), day = now.toISOString().slice(0, 10);

  // Compatibility with the first demo D1 schema used before call_count/bucket were introduced.
  // This prevents a Worker upgrade from taking Google Places offline on an existing rollout.
  if (!cols.has('bucket') && cols.has('day_key') && cols.has('day_count') && cols.has('minute_key') && cols.has('minute_count')) {
    const row = await db.prepare('select id,day_key,day_count,minute_key,minute_count from google_places_usage order by id limit 1').first();
    const dayCount = row?.day_key === day ? (+row.day_count || 0) : 0;
    const minuteCount = row?.minute_key === minute ? (+row.minute_count || 0) : 0;
    if (minuteCount >= 10) throw new Error('Google Places demo limit reached for this minute. Please retry shortly.');
    if (dayCount >= 100) throw new Error('Google Places demo daily limit reached. Please retry tomorrow.');
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
  if ((m?.call_count || 0) >= 10) throw new Error('Google Places demo limit reached for this minute. Please retry shortly.');
  if ((d?.call_count || 0) >= 100) throw new Error('Google Places demo daily limit reached. Please retry tomorrow.');
  await db.batch([
    db.prepare('insert into google_places_usage(bucket,call_count,updated_at) values(?,1,?) on conflict(bucket) do update set call_count=call_count+1,updated_at=excluded.updated_at').bind(minuteKey, now.toISOString()),
    db.prepare('insert into google_places_usage(bucket,call_count,updated_at) values(?,1,?) on conflict(bucket) do update set call_count=call_count+1,updated_at=excluded.updated_at').bind(dayKey, now.toISOString()),
    db.prepare("delete from google_places_usage where updated_at < datetime('now','-3 days')")
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

async function verifyEditor(request, env) {
  const bearer = clean(request.headers.get('Authorization'));
  if (!bearer.toLowerCase().startsWith('bearer ')) throw new Error('System Administrator sign-in is required.');
  const token = bearer.slice(7).trim();
  const base = clean(env.SUPABASE_URL).replace(/\/$/, '');
  const key = clean(env.SUPABASE_PUBLISHABLE_KEY);
  if (!base || !key) throw new Error('Worker admin verification is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
  const userRes = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  const user = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !user?.id) throw new Error('Your Pers sign-in could not be verified.');
  const pRes = await fetch(`${base}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  const rows = await pRes.json().catch(() => []);
  const role = rows?.[0]?.role || '';
  if (!['sysadmin', 'admin'].includes(role)) throw new Error('System Administrator permission is required.');
  return { id: user.id, role };
}

function keyHint(key) { const s = clean(key); return s ? `••••${s.slice(-4)}` : ''; }
async function changeWorkerSecret(env, key, mode, remove = false) {
  const accountId = clean(env.CLOUDFLARE_ACCOUNT_ID);
  const scriptName = clean(env.CLOUDFLARE_WORKER_SCRIPT_NAME);
  const token = clean(env.CLOUDFLARE_API_TOKEN);
  if (!accountId || !scriptName || !token) throw new Error('Cloudflare key replacement is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_WORKER_SCRIPT_NAME and the CLOUDFLARE_API_TOKEN secret.');
  const secrets = remove ? {
    GOOGLE_PLACES_API_KEY: null,
    GOOGLE_PLACES_MODE: null
  } : {
    GOOGLE_PLACES_API_KEY: { type: 'secret_text', name: 'GOOGLE_PLACES_API_KEY', text: key },
    GOOGLE_PLACES_MODE: { type: 'secret_text', name: 'GOOGLE_PLACES_MODE', text: mode }
  };
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(scriptName)}/secrets-bulk`, {
    method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ secrets })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.success === false) throw new Error(j?.errors?.[0]?.message || `Cloudflare secret update failed (${r.status}).`);
  return j;
}

async function handleAdminGoogleConnection(request, env, headers) {
  await verifyEditor(request, env);
  const input = await request.json().catch(() => ({}));
  const action = clean(input?.action).toLowerCase();
  if (action === 'status') {
    const key = clean(env.GOOGLE_PLACES_API_KEY);
    return new Response(JSON.stringify({ connected: !!key, mode: clean(env.GOOGLE_PLACES_MODE) || '', keyHint: keyHint(key) }), { status: 200, headers });
  }
  if (action === 'replace') {
    const key = clean(input?.key); const mode = clean(input?.mode).toLowerCase();
    if (!key || key.length < 12) return new Response(JSON.stringify({ error: 'A valid Google API key is required.' }), { status: 400, headers });
    if (!['demo', 'production'].includes(mode)) return new Response(JSON.stringify({ error: 'Mode must be demo or production.' }), { status: 400, headers });
    await changeWorkerSecret(env, key, mode, false);
    return new Response(JSON.stringify({ connected: true, mode, keyHint: keyHint(key) }), { status: 200, headers });
  }
  if (action === 'remove') {
    await changeWorkerSecret(env, '', '', true);
    return new Response(JSON.stringify({ connected: false, mode: '', keyHint: '' }), { status: 200, headers });
  }
  return new Response(JSON.stringify({ error: 'Unknown Google connection action.' }), { status: 400, headers });
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
      if (path.endsWith('/admin/google-connection')) return await handleAdminGoogleConnection(request, env, headers);
      if (!env.GOOGLE_PLACES_API_KEY) return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY secret is not configured.' }), { status: 500, headers });
      const input = await request.json();
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
      return new Response(JSON.stringify({ provider: 'google-places', places: places.slice(0, 15) }), { status: 200, headers });
    } catch (e) {
      const msg = e?.message || 'Places service failed.';
      const status = /permission|required|verified|sign-in/i.test(msg) ? 403 : 500;
      return new Response(JSON.stringify({ error: msg }), { status, headers });
    }
  }
};
