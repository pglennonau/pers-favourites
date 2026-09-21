# Pers Favourites PWA

Version: **0.27.26**

## v26 update — 21 September 2026

List/detail photo recovery now synchronises every visible frame for the same venue. Cards keep a consistent action order, with missing contact/link details disabled. Pers/User rating summaries share a layout, the summary uses a prominent **Filters** chevron toggle, and every app dialog has a bottom **Return** button. Mobile inputs and dialog sizes have additional viewport safeguards; real iPhone acceptance remains pending.

Deploy `release/0.27.26`; the package is `Pers_Favourites_v0.27.26_Code.zip`. Confirm **0.27.26** after installing the update; do not clear site data. Older release notes below are historical. No Cloudflare deployment or quota increase is needed. See [v26 QA](docs/QA_V0.27.26.md).
Date: **20 September 2026**

Pers Favourites is a curated PWA catalogue. The current release stores the Pers collection locally on the device/browser. Cloudflare is the only backend/service direction for this project.

## Foundation retained from 0.27.23

- Builds on v0.27.22 with **Cloudflare as the sole backend/service direction**.
- Adds the v0.27.23 foundation for authorised TripAdvisor Terra API access; no scraping.
- Adds configurable TripAdvisor free-allowance controls in Cloudflare, with warning and automatic cutoff thresholds.
- Keeps paid TripAdvisor usage off unless it is explicitly enabled server-side.
- Separates Pers, Google Places and TripAdvisor result presentation rather than blending provider rankings.
- Sets venue-photo fallback order to **Pers → Google Places → TripAdvisor → placeholder**.
- Adds Owner-facing Costs & Payments visibility while keeping API secrets and full payment-card details outside the PWA.
- Corrects Google Places demo/production handling so demo caps are not incorrectly applied to production mode.
- All third-party copyright, licensing, attribution, privacy, storage and rate-limit requirements remain mandatory.

TripAdvisor may remain disabled at deployment until the actual developer/API entitlement, allowance period and credentials are confirmed. This does not block deployment of the rest of v0.27.25.

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

For initial service setup, configure these directly in Cloudflare. Existing v0.27.23 installations need no Cloudflare changes for v0.27.25:

- `GOOGLE_PLACES_API_KEY` as a Worker secret.
- `GOOGLE_PLACES_MODE` as a Worker secret, typically `demo` or `production`.
- `ALLOWED_ORIGIN` to the deployed Pers Favourites site where appropriate.
- `USAGE_DB` D1 binding if usage tracking/rate limiting is enabled.

For v0.27.25 TripAdvisor support, also configure:

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
2. Replace the files in the local GitHub repository folder with the v0.27.25 package contents.
3. Do not copy the ZIP itself into the repository.
4. In GitHub Desktop confirm repository **pers-favourites** and branch **main**.
5. Review the changed files.
6. Commit with a message such as `Deploy v0.27.25`.
7. Push origin.
8. Open the PWA and confirm the displayed version is **0.27.25**.
9. Use **Account & Settings → App Updates** if the installed PWA still shows an older cached version.

## v0.27.25 QA gate

Before release:

- JavaScript and Cloudflare Worker syntax pass.
- No duplicate or missing static HTML control IDs.
- Version is 0.27.25 consistently in app, config, service worker and version file.
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

## v0.27.24 changes

- Current filters, sort and selected sources remain visible above results when Filters is closed. Remove individual chips or clear filters; sorting and source choices are retained.
- Selecting Nearest requests device location. Missing location is explained; missing venue coordinates sort last. Other sorts use A–Z for ties and put missing values last.
- Pers rating, user rating and personal date sorts apply to saved Pers entries. External results use A–Z for those choices, with an explanation in the summary.
- External Google cards now show available photos with attribution. Saved Google photos are reused briefly within the page session so sorting does not repeatedly request the same displayed photo. Failures show an explanation and Retry photo.
- All cards use compact rating pills. Existing one-to-four uploaded-photo collages remain intact.
- Cloudflare Worker, API secrets, quotas, authentication and local storage identifiers are unchanged. Photo availability still depends on provider data and service limits.
- QA: `node qa/release-check.mjs`, `node qa/worker-unit.mjs`, and `node qa/frontend-check.cjs` (requires jsdom 30.1.0 in the test environment).


## v0.27.25 local-trial update

Photo areas now stay attached to their venues during sorting and adding places. Provider photo matching uses the saved provider ID where available and rejects ambiguous alternatives. The selections summary can be collapsed and expanded without clearing filters. Missing coordinates are excluded from the map.

This remains a local trial, with no secure email/password accounts. See [the QA audit](docs/QA_V0.27.25.md) and [account implementation requirements](docs/ACCOUNT_SETUP.md) for outstanding work.
