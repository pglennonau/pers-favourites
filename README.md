# Pers Favourites PWA

Version: **0.27.23**  
Date: **19 September 2026**

Pers Favourites is a curated PWA catalogue. The current release stores the Pers collection locally on the device/browser. Cloudflare is the only backend/service direction for this project.

## 0.27.23 development scope

- Builds on v0.27.22 with **Cloudflare as the sole backend/service direction**.
- Adds the v0.27.23 foundation for authorised TripAdvisor Terra API access; no scraping.
- Adds configurable TripAdvisor free-allowance controls in Cloudflare, with warning and automatic cutoff thresholds.
- Keeps paid TripAdvisor usage off unless it is explicitly enabled server-side.
- Separates Pers, Google Places and TripAdvisor result presentation rather than blending provider rankings.
- Sets venue-photo fallback order to **Pers → Google Places → TripAdvisor → placeholder**.
- Adds Owner-facing Costs & Payments visibility while keeping API secrets and full payment-card details outside the PWA.
- Corrects Google Places demo/production handling so demo caps are not incorrectly applied to production mode.
- All third-party copyright, licensing, attribution, privacy, storage and rate-limit requirements remain mandatory.

## Current architecture

- **PWA hosting:** GitHub Pages.
- **Pers venue data:** local browser/device storage.
- **Google Places:** PWA → Cloudflare Worker → Google Places API.
- **TripAdvisor:** optional authorised Terra API via the same Cloudflare service layer; disabled until configured and explicitly enabled.
- **Photos:** local device storage in this release; future shared storage will use Cloudflare.
- **Authentication:** local test roles only in this release; future production authentication will use a Cloudflare-based design.

## v0.27.21 functionality retained

- Per-user language selector.
- Shared managed lists for Filters and Add/Edit.
- Owner/System Administrator list management.
- Open Now.
- Optional Google Places and TripAdvisor source selectors.
- Pers results first, with external-only results under More Places Nearby.
- De-duplication of external results against Pers.
- Source-specific ratings, never a synthetic combined rating.
- One-tap TripAdvisor link when a compliant listing match is available.
- Country → State/Region → City/Town cascades and searchable selectors.
- Existing archive, ratings, photos, imports, backups and map/list features.

## Cloudflare Google Places Worker

The Worker source is in:

`cloudflare/places-search-worker.js`

For v0.27.23, configure these directly in Cloudflare:

- `GOOGLE_PLACES_API_KEY` as a Worker secret.
- `GOOGLE_PLACES_MODE` as a Worker secret, typically `demo` or `production`.
- `ALLOWED_ORIGIN` to the deployed Pers Favourites site where appropriate.
- `USAGE_DB` D1 binding if usage tracking/rate limiting is enabled.

For v0.27.23 TripAdvisor support, also configure:

- `TRIPADVISOR_API_KEY` as a Worker secret.
- `TRIPADVISOR_ENABLED` — default `false`.
- `TRIPADVISOR_FREE_ALLOWANCE` — configurable; do not assume the current advertised allowance will remain unchanged.
- `TRIPADVISOR_ALLOWANCE_PERIOD` — `one-time`, `monthly`, `daily` or `custom`.
- `TRIPADVISOR_PERIOD_ID` when using a custom period.
- `TRIPADVISOR_WARNING_PERCENT` — normally `50`.
- `TRIPADVISOR_CUTOFF_PERCENT` — normally `95`.
- `TRIPADVISOR_OWNER_PAID_APPROVED` — default `false`.
- `TRIPADVISOR_ALLOW_PAID` — default `false`.
- `TRIPADVISOR_BILLING_URL` — optional non-secret billing-management link.

The Worker requires `USAGE_DB` before making TripAdvisor API calls so the cost cutoff cannot be bypassed accidentally.

The PWA stores only the Worker URL.

## Third-party compliance

Pers Favourites must use official or otherwise authorised APIs and links. Do not scrape, republish or permanently cache third-party content unless the provider expressly permits it. Provider-specific ratings and opening status are treated as live/transient data. Required source attribution and links must be preserved.

## Deployment

1. Export a current backup from Pers Favourites before a material update.
2. Replace the files in the local GitHub repository folder with the v0.27.23 package contents.
3. Do not copy the ZIP itself into the repository.
4. In GitHub Desktop confirm repository **pers-favourites** and branch **main**.
5. Review the changed files.
6. Commit with a message such as `Deploy v0.27.23`.
7. Push origin.
8. Open the PWA and confirm the displayed version is **0.27.23**.
9. Use **Account & Settings → App Updates** if the installed PWA still shows an older cached version.

## v0.27.23 QA gate

Before release:

- JavaScript and Cloudflare Worker syntax pass.
- No duplicate or missing static HTML control IDs.
- Version is 0.27.23 consistently in app, config, service worker and version file.
- No legacy backend name, URL, key, schema or migration file remains anywhere in the release tree.
- The deployable ZIP contains `index.html`, app assets, icons and Cloudflare Worker source.
- Filter/master-list, language, Open Now, external search, ratings, archive, import/export and local photo paths remain wired.
- The package is generated from the release branch by GitHub Actions and its required-file checks pass.

## Release documentation

The current release documentation is limited to three role-based guides:

- `docs/OWNER_GUIDE.md`
- `docs/SYSTEM_ADMINISTRATOR_GUIDE.md`
- `docs/USER_GUIDE.md`

The System Administrator Guide contains the documentation change log. Every release must update all affected guides as part of the release QA gate.

## Core file discipline

Keep one current deployable PWA package and one current consolidated documentation set. Older versions are archive/history rather than parallel current copies.
