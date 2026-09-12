# Pers Favourites PWA v027c

Version 0.27.3. v027c is an incremental refinement of v027, not a new major version.

## What is included

- Public read-only browsing without login.
- Cloudflare production backend: Pages/Functions, D1 database and R2 venue-photo storage.
- Cloudflare Access protection for Owner/Admin and contribution actions.
- Intelligent searchable entry for Place Type, Cuisine, Country, State/Region, City/Town, Suburb/Area, Meal/Visit Type, Great For, Features, Dietary and Tags.
- Administrator-maintained master lists in Settings. Existing legitimate database values also feed suggestions.
- Controlled country names and alias normalisation to reduce duplicates.
- Agreed Cuisine list, including Mediterranean, Asiatico, Carne/Meat, Gastronomico, Mallorquin, Michelin, Pescados/Fish-Paellas, Fusion, Tapas, Vegetariano/Vegan and Italiano/Italian.
- `+ Add Place`, `Find Online`, and `Import Places` entry routes.
- Find Online accepts venue-name/location searches and Google Maps links. The server-side lookup uses OpenStreetMap/Nominatim and keeps source provenance. It does not scrape Google Maps or Tripadvisor.
- Official venue Website, Directions, Call, Book and Share quick actions where data is available.
- Import of Google Takeout ZIP, CSV, JSON and GeoJSON; automatic common-field mapping; one-place test import; duplicate Keep/Merge/Replace decisions; optional bulk tag; import summary; Undo Last Import.
- Bulk Edit of the places currently shown by filters.
- Visited / Want to Try, Last Visited, Times Visited and Would Go Again.
- Quick filters, Tonight/Nearby, Smart Collections, map/list views and backup/export.
- Optional Ask Pers natural-language search. It is OFF by default and must be enabled by the Owner in Settings. The OpenAI API key is held only as a Cloudflare secret. Ask Pers generates a controlled structured query plan; it does not receive the Pers venue database and cannot submit arbitrary SQL.

## Local test

`config.js` is supplied in `mode: "local"` so Pat/Per can test the app before Cloudflare is connected. Open the hosted HTTPS PWA, start the local trial, then use Add Place / Find Online / Import Places. Local trial data is kept in the browser on that device.

## Cloudflare production

Copy `config.example.js` to `config.js`, set a unique `deploymentId`, set `mode: "cloudflare"`, then configure Cloudflare as described in `cloudflare/README.md` and the Setup/Admin Guide in the Final Set.

Required bindings:

- `PERS_DB` -> D1 database
- `PERS_PHOTOS` -> R2 bucket

Protect `/api/admin*` and `/api/contribute*` with separate Cloudflare Access applications/policies so each can have its own Audience (AUD). Keep `/api/public` and `/media/*` public so ordinary browsing needs no login.

Ask Pers requires `OPENAI_API_KEY` as a Cloudflare secret only when the Owner chooses to enable the feature.

## Important production note

A live Cloudflare deployment is required to fully verify Access authentication, D1/R2 bindings, R2 photo uploads, the server-side online lookup, and Ask Pers with a real API key. All local/static checks recorded in the v027c QA Record should be completed before that live verification.
