# Pers Favourites PWA v027g

Version: 0.27.7

Upload the contents of this folder to the existing GitHub Pages/static HTTPS deployment. Preserve rollout-specific values in `config.js` such as deploymentId, Supabase URL and browser-safe publishable key.

## Existing v027f rollout -> v027g

1. Export a fresh backup and keep the current GitHub commit.
2. No Supabase SQL migration is required for v027f -> v027g.
3. Replace the deployed static PWA files with this package, preserving rollout-specific `config.js` connection values.
4. Publish and fully close/reopen the installed PWA.
5. Confirm Version 0.27.7.
6. Open Account & Settings and verify Google Places search endpoint.

If upgrading from v027e or v026, first apply the included migration to the v027f database schema, then deploy v027g.

## Important: Find Place Online and Google Places

GitHub Pages alone does not activate Google Places. The shipped `config.js` intentionally contains no API key and normally no Worker endpoint. For Google-quality current business search:

1. Deploy `cloudflare/places-search-worker.js` as a Cloudflare Worker.
2. Store `GOOGLE_PLACES_API_KEY` as a Worker secret.
3. Copy the Worker HTTPS URL.
4. In Pers, sign in as Owner/Admin and open Account & Settings.
5. Paste the URL into Google Places search endpoint and save.
6. Tap Test Google Places connection until it reports Connected.

If the endpoint is blank or unavailable, v027g uses OpenStreetMap/Nominatim as a fallback and says so explicitly. That fallback may miss restaurants present in Google Maps. A direct Search Google Maps action is provided.

## v027g search corrections

- Visible provider state; no silent assumption that OpenStreetMap equals Google business coverage.
- `Brutus Restaurant` normalizes to `Brutus`.
- OpenStreetMap/Overpass fallback is accent tolerant for names such as Breogan/Breogán.
- Search wider remains an explicit user action.
- Country -> State/Region -> City filters remain database-driven cascades.

Older database upgrades use the existing files `supabase/migration_v027e_to_v027f.sql` or `supabase/migration_v026_to_v027f.sql` before deploying v027g.
