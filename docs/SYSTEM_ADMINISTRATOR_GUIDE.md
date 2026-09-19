# Pers Favourites — System Administrator Guide

Version: **0.27.23 development**

The System Administrator must understand the full Pers Favourites system, including Owner-facing controls, deployment, Cloudflare services, API connections, security, quotas, billing safeguards, backups, troubleshooting and recovery.

## Architecture

- PWA hosting: GitHub Pages.
- Active Pers catalogue storage in this development release: local browser/device storage.
- Backend/service direction: Cloudflare only.
- Google Places: PWA → Cloudflare Worker → Google Places API.
- TripAdvisor: PWA → Cloudflare Worker → authorised TripAdvisor Terra API.
- Future shared catalogue/auth/photos: Cloudflare components such as D1, KV, R2 and Workers as appropriate.
- Do not reintroduce the superseded backend; Cloudflare is the approved backend/service direction.

## Cloudflare Worker

Worker source:

`cloudflare/places-search-worker.js`

Current public Worker used by the trial:

`https://pers-places-search.pglennon-au.workers.dev`

The Worker accepts POST requests. A browser GET showing `POST required` is expected.

### Required/common bindings

- `USAGE_DB` — D1 binding used for Google/TripAdvisor usage counters and safeguards.
- `ALLOWED_ORIGIN` — normally the GitHub Pages origin, for example `https://pglennonau.github.io`.

## Google Places connection

Cloudflare secrets/variables:

- `GOOGLE_PLACES_API_KEY` — secret.
- `GOOGLE_PLACES_MODE` — `demo` or `production`.
- `ALLOWED_ORIGIN`.
- `USAGE_DB`.

v0.27.23 fixes the earlier behaviour where demo caps were applied regardless of mode.

- Demo mode: 10 Google API calls per minute and 100 per day.
- Production mode: requires explicit positive `GOOGLE_PLACES_PRODUCTION_MINUTE_LIMIT` and `GOOGLE_PLACES_PRODUCTION_DAILY_LIMIT` variables. The Worker blocks production calls if these safeguards have not been configured.
- `USAGE_DB` is mandatory for Google calls so rate/cost safeguards cannot silently be bypassed.

The raw Google key must never be stored in the PWA, localStorage or GitHub.

### Google Places data-handling rules

The current Google Places policy permits indefinite storage of a Google Place ID, but restricts storage/caching of other Places content. Google photo resource names must not be cached and can expire.

v0.27.23 therefore:

- removes the old browser/localStorage Google photo-name cache;
- strips legacy stored Google photo names/attribution and live ratings/opening status when local state is normalised;
- obtains a fresh photo name from a live Places response immediately before requesting the photo;
- displays Google Maps attribution, available author attribution, and the individual source-photo link returned by Google;
- keeps Google/TripAdvisor live ratings and opening status in memory only for the active session;
- when an Owner selects a Google result, keeps the Google Place ID but does not permanently copy unchanged Google-supplied name/address/phone/website/location values into Pers;
- constructs the Google Maps link from the saved Place ID rather than storing the API-returned URI;
- does not use Google-supplied coordinates as persistent pins on the Leaflet/OpenStreetMap map unless the Owner independently enters/edits coordinates.

Google Maps Platform content must not be shown as though it were Pers content, and Google Maps attribution must remain visible.

## TripAdvisor Terra connection

Use only an authorised TripAdvisor API. Do not scrape Tripadvisor web pages.

Cloudflare configuration:

- `TRIPADVISOR_API_KEY` — secret.
- `TRIPADVISOR_ENABLED` — default `false`; set to `true` only after the account/API plan is confirmed.
- `TRIPADVISOR_FREE_ALLOWANCE` — configurable numeric allowance and defaults to zero when unset. Do not assume 1,000 is permanent. API use remains paused until the actual account allowance is entered, unless both paid-use gates are explicitly enabled.
- `TRIPADVISOR_ALLOWANCE_PERIOD` — `one-time`, `monthly`, `daily` or `custom`.
- `TRIPADVISOR_PERIOD_ID` — used when the allowance period is `custom`.
- `TRIPADVISOR_WARNING_PERCENT` — normally `50`.
- `TRIPADVISOR_CUTOFF_PERCENT` — normally `95`.
- `TRIPADVISOR_OWNER_PAID_APPROVED` — default `false`; set to `true` only after explicit Owner approval is recorded.
- `TRIPADVISOR_ALLOW_PAID` — default `false`; separate System Administrator enablement for paid calls.
- `TRIPADVISOR_BILLING_URL` — optional provider billing-management link.
- `USAGE_DB` — mandatory for TripAdvisor cost protection.

The Worker refuses TripAdvisor API calls if `USAGE_DB` is unavailable, because the free-allowance cutoff cannot then be enforced safely.

### TripAdvisor usage logic

The Worker keeps the authoritative count in D1.

- Below 50%: Active.
- At/above 50%: Warning.
- At/above 95%: Paused unless both protected paid-use gates are true.
- `TRIPADVISOR_OWNER_PAID_APPROVED=true` confirms explicit Owner approval.
- `TRIPADVISOR_ALLOW_PAID=true` is the separate System Administrator enablement.
- Owner approval in the PWA is the human approval record; the System Administrator mirrors that approval to Cloudflare before enabling paid use.

The allowance period must reflect the actual commercial entitlement in the TripAdvisor developer account. Do not automatically reset a one-time allowance each month.

### TripAdvisor endpoints in this Worker

- `/tripadvisor-search` — authorised Terra location search.
- `/tripadvisor-photo` — retrieves a live photo only when needed as the last photo fallback.
- `/services/status` — safe service/usage status for the Owner/System Administrator UI.

The API key itself is never returned.

## Photo-source policy

Venue card/detail image priority:

1. Pers-approved photo;
2. live Google Maps/Places photo;
3. live TripAdvisor photo;
4. placeholder.

TripAdvisor is deliberately last because it can consume a limited API allowance. External photos remain live provider content; do not copy them into Pers photo storage unless provider terms expressly permit it.

## Search-source policy

Render separate provider sections:

- Pers Favourites
- More places from Google
- TripAdvisor results

Do not produce a blended Google/TripAdvisor ranking. Keep source ratings separate. Google content containers use exact **Google Maps** attribution. TripAdvisor ratings use provider-supplied rating branding where available.

## OpenAI / Ask Pers

Owner controls whether Ask Pers is enabled. System Administrator controls the technical endpoint and future server-side OpenAI credential. Any OpenAI credential must be a Cloudflare secret, not browser storage.

## Costs & Payments

The Owner view is a summary/control surface, not a payment processor. Pers must not store full card details.

Transaction-level history is shown only when an authorised provider API exposes reliable billing transactions. Otherwise show usage/cost summaries and link to the provider billing portal.

## Public Terms and Privacy pages

The deployable PWA contains:

- `terms.html`
- `privacy.html`

Both are linked from the app footer. They must stay publicly accessible with the PWA. The Terms page incorporates the Google Maps Platform terms by reference; the Privacy page incorporates the Google Privacy Policy by reference and describes current Cloudflare/location/provider processing.

## Deployment procedure

1. Confirm the release branch and version.
2. Run syntax and regression QA.
3. Confirm all visible version labels match.
4. Update this guide, Owner Guide and User Guide.
5. Update the documentation change log below.
6. Build the complete code ZIP including PWA and Cloudflare source.
7. Deploy PWA through GitHub only after QA.
8. Deploy the matching Worker code in Cloudflare.
9. Verify Worker bindings/secrets.
10. Test Google, TripAdvisor status, filters, photos, roles, import/export and archive.

## Documentation Change Log

### v0.27.23

- Owner Guide: added Costs & Payments, TripAdvisor safeguards, separated external search, photo-source priority, Google live-content handling and legal-page summary.
- System Administrator Guide: added full Google/TripAdvisor/Cloudflare connection instructions, Google demo/production safeguards, TripAdvisor quota settings, provider content/storage rules, legal pages and deployment checks.
- User Guide: updated external-result sections, provider attribution, ratings, photo-source behaviour and Terms/Privacy access.
- Code package: adds the PWA, Cloudflare Worker, Terms/Privacy pages and supporting deployment files.

Every future release must update all affected guides before the release is considered complete.
