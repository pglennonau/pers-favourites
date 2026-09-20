# Pers Favourites — System Administrator Guide

Version: **0.27.24**

This is the complete technical and operational reference for Pers Favourites. The System Administrator must understand both the technical system and the Owner/User workflows. It is intentionally broader than the Owner Guide.

## 1. Role model and responsibilities

### User

Ordinary Users browse without signing in. They can use search, filters, list/map views, personal preferences, ratings and — where enabled — contribute photos using lightweight identity at the point of contribution.

### Owner

The Owner controls the Pers collection: venues, Pers Ratings, managed lists, photo moderation, imports/backups, archive/permanent delete, collection identity, optional features, external-service cost approvals and spending caps.

### System Administrator

The System Administrator is responsible for:

- deployment and release management;
- Cloudflare Workers and bindings;
- API secrets and provider configuration;
- rate/cost safeguards;
- authentication architecture;
- backups/recovery support;
- technical troubleshooting;
- provider terms/API compatibility;
- ensuring the Owner controls work as documented.

During initial setup/handover, Pat/System Administrator also has temporary Owner-level access through the proper role model so configuration can be tested. At handover, the temporary Owner permission is removed while System Administrator access remains.

In the current local test implementation, `hasOwnerAccess()` deliberately grants the local System Administrator identity Owner-level access for setup testing. Production must implement this through authenticated role assignment rather than a generic password or browser-only role selector.

## 2. Owner functions the System Administrator must understand

The System Administrator must be able to explain and troubleshoot every Owner workflow, including:

- Collection settings: app name, Owner display name, home region, User photo contributions, Near Me radius, Ask Pers enablement.
- Add/Edit venue and Find Place Online.
- Pers Rating versus User/Google/TripAdvisor ratings.
- Photo moderation and the Pers → Google → TripAdvisor → placeholder priority.
- Managed list maintenance.
- Archive, restore and Owner-only permanent delete.
- Single-venue test import and bulk CSV/JSON/GeoJSON/Google Takeout import.
- Full backup/export and restore implications.
- Costs & Payments cards for Google, TripAdvisor, Cloudflare and OpenAI.
- Owner spending caps and paid-service authorisation.
- App update checks and handover.

If an Owner-facing feature changes, this guide and the Owner Guide must both be updated.

## 3. Architecture

- **PWA hosting:** GitHub Pages.
- **Active Pers catalogue storage in v0.27.24:** local browser/device storage.
- **Backend/service direction:** Cloudflare only.
- **Google Places:** PWA → Cloudflare Worker → Google Places API.
- **TripAdvisor:** PWA → Cloudflare Worker → authorised Tripadvisor Terra API.
- **OpenAI/Ask Pers:** future/optional server-side endpoint through Cloudflare.
- **Future shared catalogue/auth/photos:** Cloudflare D1/KV/R2/Workers as appropriate.
- Do not reintroduce the superseded backend.

## 4. Release source and file structure

The release branch for this version is:

`release/0.27.24`

Key files:

- `index.html`, `app.js`, `styles.css` — PWA UI/application.
- `config.js` — deployed rollout configuration.
- `config.example.js` — safe configuration example.
- `branding.js` — app/manifest/Home Screen naming.
- `sw.js` — service worker and shell cache.
- `manifest.webmanifest` — base manifest fallback.
- `cloudflare/places-search-worker.js` — Google/TripAdvisor service Worker.
- `qa/release-check.mjs` — static release regression checks.
- `qa/worker-unit.mjs` — Cloudflare Worker unit tests.
- `terms.html`, `privacy.html` — public legal/support pages.
- `docs/OWNER_GUIDE.md`, `docs/SYSTEM_ADMINISTRATOR_GUIDE.md`, `docs/USER_GUIDE.md` — the three primary manuals.

## 5. Cloudflare Worker

Current trial Worker endpoint:

`https://pers-places-search.pglennon-au.workers.dev`

The Worker accepts POST requests. Opening the URL directly in a browser may return `POST required`; that is expected.

### Common configuration

- `ALLOWED_ORIGIN` — the deployed PWA origin. Current GitHub Pages origin is `https://pglennonau.github.io`.
- `USAGE_DB` — D1 binding used for Google and TripAdvisor usage counters/safeguards.

Do not put secret API keys into `config.js`, GitHub source or localStorage.

## 6. Google Places connection

### Cloudflare secrets/variables

- `GOOGLE_PLACES_API_KEY` — secret.
- `GOOGLE_PLACES_MODE` — `demo` or `production`.
- `GOOGLE_PLACES_PRODUCTION_MINUTE_LIMIT` — required positive value in production mode.
- `GOOGLE_PLACES_PRODUCTION_DAILY_LIMIT` — required positive value in production mode.
- `USAGE_DB`.
- `ALLOWED_ORIGIN`.

### Mode behaviour

Demo mode currently uses conservative safeguards of 10 calls/minute and 100 calls/day.

Production mode does **not** inherit those Demo caps. It requires explicit positive production minute/day limits. If they are missing, production calls are blocked rather than running without a safeguard.

### Google data handling

Google content is treated as provider content, not Pers-owned data.

The current design:

- permits storage of the Google Place ID;
- does not retain Google photo resource names in local Pers data;
- obtains a fresh live photo reference before requesting a Google photo;
- carries live ratings/opening state in the active session rather than Pers storage;
- shows Google Maps attribution and available photo/source attribution;
- constructs a Google Maps link from the Place ID rather than persisting the API-returned URL;
- does not persist unchanged Google-supplied coordinates into Pers/Leaflet as though they were Pers data.

Before changing this behaviour, re-check the current Google Maps Platform policies and attribution/storage requirements.

## 7. TripAdvisor Terra connection

Use only the authorised Tripadvisor Terra API. Do not scrape Tripadvisor public pages.

Current Terra documentation identifies `GET /locations/search` for location search. Terra uses the `X-API-Key` header. Search/nearby endpoints have provider-specific rate limits, so the PWA serialises TripAdvisor searches with an interval rather than firing rapid parallel search calls.

### Cloudflare secrets/variables

- `TRIPADVISOR_API_KEY` — secret.
- `TRIPADVISOR_ENABLED` — default false.
- `TRIPADVISOR_FREE_ALLOWANCE` — configured from the actual account entitlement; defaults to zero when unset.
- `TRIPADVISOR_ALLOWANCE_PERIOD` — `one-time`, `monthly`, `daily` or `custom`.
- `TRIPADVISOR_PERIOD_ID` — required if custom period semantics are used.
- `TRIPADVISOR_WARNING_PERCENT` — normally 50.
- `TRIPADVISOR_CUTOFF_PERCENT` — normally 95.
- `TRIPADVISOR_OWNER_PAID_APPROVED` — default false; reflects explicit Owner approval.
- `TRIPADVISOR_ALLOW_PAID` — default false; separate System Administrator enablement.
- `TRIPADVISOR_BILLING_URL` — optional provider billing-management URL.
- `USAGE_DB` — mandatory for TripAdvisor calls.

The Worker refuses TripAdvisor API calls when `USAGE_DB` is unavailable, because the cost cutoff cannot then be enforced safely.

### Usage states

- Below warning threshold: **Active**.
- At/above warning threshold: **Warning**.
- At/above cutoff: **Paused**, unless both paid-use gates are true.
- No configured free allowance: API remains blocked unless both paid-use gates are explicitly enabled.

Paid usage must never begin from the PWA checkbox alone.

TripAdvisor activation is optional for initial v0.27.24 deployment. If the developer/API account is not yet configured, leave `TRIPADVISOR_ENABLED=false`; the rest of the release can be deployed and tested normally.

### Allowance/reset model

Do not assume a recurring monthly allowance. Configure the period to match the actual account/developer dashboard.

A monthly public-terms check is maintained separately, but account-specific entitlements must still be verified manually in the provider dashboard where necessary.

### Terra endpoints used

- `/tripadvisor-search` in the Cloudflare Worker proxies the authorised Terra location search.
- `/tripadvisor-photo` obtains a live photo only when needed as the final provider-photo fallback.
- `/services/status` returns safe connection/usage information to Owner/System Administrator UI without exposing API keys.

TripAdvisor ratings/photo content remain provider-specific and require the appropriate attribution/branding permitted by the current provider agreement.

## 8. Photo-source logic

The required order is:

1. approved Pers photo;
2. Google Places photo;
3. TripAdvisor photo;
4. placeholder.

TripAdvisor must never be queried for a fallback photo when an approved Pers photo or usable Google photo already exists.

The code path is checked in release QA.

## 9. External search presentation

The app must keep provider sections separate:

- Pers Favourites;
- More places from Google;
- TripAdvisor results.

Do not create a blended Google/TripAdvisor ranking or synthetic rating. Keep source-specific ratings and direct source links.

## 10. Costs & Payments architecture

The Owner view is a management/approval surface, not a payment processor.

Current Owner fields include separate spending caps for:

- Google Places;
- TripAdvisor;
- Cloudflare;
- OpenAI/Ask Pers.

Provider-side billing remains authoritative. Where possible, configure the provider's own budget/cap in addition to the Pers-side Owner record.

Do not store:

- full card numbers;
- CVV/security codes;
- provider passwords;
- raw API keys.

Show masked payment metadata only if a provider safely exposes it through an authorised API.

Transaction-level history should only be shown when the official provider API supports it reliably. Otherwise show a usage/cost summary and link to the provider billing portal.

## 11. OpenAI / Ask Pers

The Owner controls the Ask Pers enable/disable switch.

The System Administrator controls:

- the Cloudflare/server endpoint;
- future server-side OpenAI credential;
- provider billing/budget;
- service health.

Ask Pers must translate natural-language requests into controlled structured filters/queries. It must not allow unrestricted SQL or invent Pers venues.

## 12. Authentication and handover

Current v0.27.24 is a local-data/local-role test release. Production authentication remains a later Cloudflare-based implementation.

Production protected access requirements remain:

- Owner/System Administrator rights tied to authenticated accounts/roles;
- passkey/WebAuthn support, with Face ID where the device/browser presents it;
- secure password fallback;
- email-based recovery;
- no shared predictable Owner password;
- temporary Pat Owner permission removable at handover.

## 13. Import/export and recovery support

Before a material release, import or destructive change, obtain a current export.

For bulk import:

1. test one venue;
2. preview/map the fields;
3. run duplicate checks;
4. only then bulk import.

Supported inputs include extracted Google Takeout/CSV/JSON/GeoJSON files.

Current local storage means clearing browser/site data can remove the active local catalogue. Backups matter.

## 14. Public Terms and Privacy pages

The deployable PWA contains:

- `terms.html`;
- `privacy.html`.

Both must remain publicly accessible and linked in the app footer.

The Terms page incorporates Google Maps Platform terms by reference. The Privacy page references the Google Privacy Policy and describes current local storage, location use, Cloudflare routing and external-provider processing.

## 15. Deployment procedure

1. Confirm the source branch is `release/0.27.24`.
2. Confirm the branch is based on the correct preceding release.
3. Run JavaScript syntax checks.
4. Run `node qa/release-check.mjs`.
5. Run `node qa/worker-unit.mjs`.
6. Confirm the GitHub Actions **Pers Favourites Release QA** workflow is green.
7. Confirm version `0.27.24` in app/config/version file/service worker/UI.
8. Confirm Owner, System Administrator and User guides are current.
9. Confirm Documentation Change Log is current.
10. Build/download the code ZIP generated from the release branch.
11. Export the live Pers backup before deployment.
12. Deploy the PWA files to GitHub `main` only after approval.
13. Deploy the matching Cloudflare Worker code.
14. Verify Worker secrets/variables/bindings.
15. Test Google connection/status.
16. If TripAdvisor is being activated, verify the actual account plan/allowance before enabling it.
17. Test Owner Costs & Payments status.
18. Test filters/cascades/search, roles, archive, import/export, ratings and photos.
19. Confirm the installed PWA displays `0.27.24`.

## 16. Troubleshooting

### Worker browser preview says POST required

Expected. Use the PWA's Test Connection/status workflow; the Worker endpoint is POST-oriented.

### Google reports production limits not configured

Set positive `GOOGLE_PLACES_PRODUCTION_MINUTE_LIMIT` and `GOOGLE_PLACES_PRODUCTION_DAILY_LIMIT` Cloudflare variables.

### TripAdvisor shows Paused

Check, in order:

1. API key exists;
2. `TRIPADVISOR_ENABLED=true`;
3. `USAGE_DB` binding is correct;
4. actual free allowance is entered;
5. allowance period is correct;
6. current call count versus cutoff;
7. Owner approval status;
8. System Administrator paid-use enablement if paid usage has genuinely been approved.

### External photo does not appear

Check Pers approved photos first. If there is no Pers photo, verify Google service/photo response. Only if Google has no usable photo should TripAdvisor be attempted.

### Old PWA version remains visible

Use **My Settings → App Updates**, then fully close/reopen if the browser has not yet activated the updated service worker.

## 17. Documentation Change Log

### v0.27.23

- **Owner Guide:** expanded into the full operating manual; added collection settings, venue management, ratings, photos, lists, archive, import/export, Costs & Payments, spending caps, Google/TripAdvisor safeguards, app updates and handover.
- **System Administrator Guide:** expanded into the complete technical/operational reference; explicitly includes all Owner workflows the Administrator must understand, Cloudflare/Google/TripAdvisor/OpenAI connection instructions, quotas, paid-use gates, deployment, troubleshooting, legal pages and recovery.
- **User Guide:** expanded for beginner use, including opening/installing the PWA, browsing, filters, location, ratings, external results, photos, preferences and help.
- **Code/QA:** v0.27.23 release QA validates provider separation, photo fallback order, provider-data safeguards, connection/cost controls and documentation presence.

Every future release must update all affected guides before the release is considered complete.

### v0.27.24 deployment and change log

Frontend-only update. Deploy the repository's main branch through GitHub Pages. Do not redeploy the Cloudflare Worker for this release: its code, secrets, bindings, limits and integration contracts are unchanged from v0.27.23.

Keep the existing deploymentId and local storage keys. Test entries are confined to the QA environment and must not be imported into the user's phone. A new service-worker shell version handles the update; do not clear browser site data.

Changes: visible selections outside collapsed filters; location request on Nearest; missing-value/tie handling; external photo rendering; reuse of displayed Google photos in memory for up to one minute; explicit provider/photo errors and manual retry; compact rating badges. No Google photo resource names are written to localStorage or exports. Existing Google attribution and separate provider sections remain.

The DOM regression suite reproduces the v0.27.23 Nearest failure and passes in v0.27.24. It uses synthetic data and mocked services, so it does not certify a particular live venue's photo or an iPhone location permission setting. TripAdvisor requires its existing service configuration and entitlement.
