function cors(origin, allowed) {
  const ok = !allowed || allowed === '*' || origin === allowed;
  return {
    'Access-Control-Allow-Origin': ok ? (allowed || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function clean(v) { return String(v ?? '').trim(); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
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
  return {
    id: p.id || '',
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    placeType: p.primaryTypeDisplayName?.text || p.primaryType || (p.types || [])[0] || '',
    primaryType: p.primaryType || '',
    country, stateRegion, city, suburb,
    website: p.websiteUri || '',
    phone: p.internationalPhoneNumber || '',
    googleMapsUrl: p.googleMapsUri || ''
  };
}
async function textSearch(env, textQuery, location, context, widen) {
  const body = { textQuery, pageSize: 10, languageCode: 'en' };
  if (location && Number.isFinite(+location.lat) && Number.isFinite(+location.lng)) {
    const lat = +location.lat, lng = +location.lng;
    if (widen) {
      body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
    } else {
      body.locationRestriction = { rectangle: rectangle(lat, lng, 30) };
    }
  } else {
    const label = [context?.city, context?.region, context?.country].map(clean).filter(Boolean).join(', ');
    if (!label) throw new Error('Current location is unavailable and no city/region fallback is known.');
    body.textQuery = `${textQuery}, ${label}`;
  }
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.primaryTypeDisplayName,places.types,places.websiteUri,places.internationalPhoneNumber,places.googleMapsUri,places.addressComponents'
    },
    body: JSON.stringify(body)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error?.message || `Google Places request failed (${r.status}).`);
  return (json.places || []).map(normalisePlace);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin, env.ALLOWED_ORIGIN || '*');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required.' }), { status: 405, headers });
    if (!env.GOOGLE_PLACES_API_KEY) return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY secret is not configured.' }), { status: 500, headers });
    try {
      const input = await request.json();
      const query = clean(input?.query);
      const normal = clean(input?.normalizedQuery);
      if (!query) return new Response(JSON.stringify({ error: 'A venue query is required.' }), { status: 400, headers });
      let places = await textSearch(env, query, input?.location, input?.context, !!input?.widen);
      if (!places.length && normal && normal.toLowerCase() !== query.toLowerCase()) {
        places = await textSearch(env, normal, input?.location, input?.context, !!input?.widen);
      }
      return new Response(JSON.stringify({ provider: 'google-places', places }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: e?.message || 'Places search failed.' }), { status: 500, headers });
    }
  }
};
