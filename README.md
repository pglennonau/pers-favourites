# Pers Favourites PWA v027f

Version: 0.27.6

This is the deployment folder. Upload the CONTENTS of this folder to the existing GitHub repository for the rollout. Do not create a new repository just because the software version changes.

## v027f highlights

- **Find Place Online is now genuinely nearby-first.** It requests the device location, runs a local OpenStreetMap name lookup plus a bounded geocoder search, and ranks exact-name nearby matches ahead of distant ones. Google Places remains an optional enhancement, not a requirement.
- Current browser/iPhone geolocation is used to constrain and rank local results. If location is denied/unavailable, the app uses selected/saved Country/State/City context and does not silently substitute worldwide results.
- A normal search no longer silently jumps to unrelated worldwide results. A separate **Search wider** action is shown when needed.
- Queries such as **Brutus** and **Brutus Restaurant** are both supported. Generic category words are also normalised for fallback/retry behaviour.
- The built-in OpenStreetMap local lookup works without extra API configuration. An optional secure Google Places endpoint can be configured for richer business data.
- Country > State/Region > City filters now cascade. State/Region remains disabled until a Country is chosen, and City waits for State/Region where the selected country's records use regions. This prevents mixed Australian/Spanish region lists.
- v027e capabilities remain: separate Pers and User Ratings, configurable Administrator display name/app name, imports, website actions, Ask Pers, moderated photos, Archive and full backup.

## Why Google Places is separate from the map

The app may continue to render map tiles using OpenStreetMap. **Find Place Online** is a business/venue discovery function and uses Google Places when configured. This separation is intentional: Google Maps/Places generally contains richer current business listings than the OpenStreetMap Nominatim geocoder.

## Existing v027e rollout -> v027f

1. Export a fresh Administrator backup.
2. For a production Supabase rollout, run `supabase/migration_v027e_to_v027f.sql`.
3. Upload the v027f deployment files to the existing GitHub repository, preserving the rollout's `deploymentId`, Supabase URL and browser-safe publishable key in `config.js`.
4. Publish GitHub Pages, fully close/reopen the installed PWA and confirm Version 0.27.6.
5. Optional: configure the Google Places Cloudflare Worker for richer venue enrichment; the nearby search works without it.

## Google Places security

Do **not** put the Google Places Web Service API key in this public GitHub PWA. Store it as the Cloudflare Worker secret `GOOGLE_PLACES_API_KEY`. Restrict the Google key to the Places API. The Worker can optionally set `ALLOWED_ORIGIN` to your GitHub Pages origin.

## Existing v026 production rollout -> v027f

If upgrading directly from v026, run the included `supabase/migration_v026_to_v027f.sql` before deploying v027f.

## New production rollout

1. Create one Supabase project for this rollout only.
2. Run `supabase/schema.sql`.
3. Set `app_settings.deployment_id` to exactly match `config.js`.
4. Create Owner/Admin authentication accounts and set their `profiles.role` values.
5. Configure authentication redirect/recovery URLs.
6. Copy `config.example.js` to `config.js` and enter the rollout settings. Use only a browser-safe Supabase publishable key.
7. Deploy over HTTPS (GitHub Pages is suitable for the static PWA).
8. Optional: configure the Google Places Cloudflare Worker and `placesSearchEndpoint` for richer venue discovery.

## Acceptance test - Palma / Brutus

With location permission allowed. Google Places is recommended for the most reliable current business coverage; the built-in OpenStreetMap path may miss some businesses:

1. Open Add/Edit Venue > Find Place Online.
2. Search `Brutus`.
3. If the enabled online provider contains the venue, the Palma venue at Carrer de Robert Graves, 2 should be returned ahead of distant matches. Nearby mode must never substitute distant worldwide Brutus results.
4. Repeat with `Brutus Restaurant`; the app normalises the generic word and searches the venue name as `Brutus`.
5. Confirm the result includes its address and, when returned by Google, website/phone/Google Maps link.

## Backup model

The Administrator backup remains a JSON package intended to preserve the logical collection: places, settings, ratings, visits, personal data available to the signed-in administrator, photo metadata, and photo binaries encoded in the backup where retrievable. Large photo collections can create a large backup file. Keep backups securely because they can contain private notes and contribution metadata.
