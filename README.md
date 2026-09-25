# Pers Favourites PWA

Version: **0.27.32**

## Version 0.27.32 — current release (25 September 2026)

This is a local-device trial release. Email/password accounts, recovery and shared cloud data are **not active**. The Cloudflare dashboard remained blocked by security verification during this release. The existing Places search service is unchanged.

### What changed

- **Find Online names:** after selecting a Google result, its full name and capitalisation appear on the saved card and in the editor. The exact linked Google Place ID is used to retrieve the live name after reopening. An intentional Owner/Administrator name edit is retained. Provider names are session data; offline or if the lookup fails, the app uses the saved independent label, with lowercase search labels capitalised. Consequently the request to retain the full provider name offline remains open. The provider's actual word order is preserved (for example, Bodega El Pimpi).
- **Duplicates:** Save and Import reject the same Google Place ID or TripAdvisor Location ID. Without conflicting provider IDs, the same normalised name and full address are also checked. Different businesses at the same address are allowed. Editing excludes the record itself; repeated Save/Import presses cannot create parallel copies. An archived match directs you to restore the existing venue.
- **Existing duplicates:** Owner or Administrator can use Review duplicate venues beside Import. Compare both records, preserve any unique notes/photos, then archive the unwanted record. The app does not merge, transfer photos or delete either record automatically.
- **Add Venue:** Owner and Administrator test identities go directly to the form, including from Archive. A read-only test identity sees a dedicated access prompt. Choosing a test identity explicitly continues into Add; Cancel makes no change. It no longer sends you to Accounts & Settings.
- **Location filters:** the 0.27.31 correction remains. Spain / España, Andalucía / Andalusia and Málaga / Malaga match. Existing Google-linked venues with missing location can be recovered by exact Place ID while online. Independently entered location fields persist offline.
- **Venue layouts:** no layout correction was required; the user confirmed that matching information produces the same layout.

### Updating safely

Use Account → My Settings → Check for Update → Install Update. Confirm **0.27.32**. Export a full backup before important changes. Do not clear site data: local venues and photos are stored on this device/browser. A code update does not synchronise data between devices.

### Accounts still to complete

Real individual Owner, Administrator and User sign-in remains an open release requirement. Test identities are not authentication. Provision a Cloudflare-backed authentication and storage service, verified email sender, session handling and server-enforced permissions; then implement and test verification, password recovery, email/password changes and sign-out. No passwords should be entered into the trial or published in configuration files. See ACCOUNT_SETUP.md for the complete acceptance checklist and handover requirements.

### Guide history

The manual and dated release notes below are retained as reference. This current-release section takes precedence over older version labels, Add navigation instructions and status statements. Historical version headings describe earlier behaviour.

## v28 navigation and photos

When scrolling, a compact bar keeps Places/count, List/Map and Filters available. Add and Sort are hidden only in this compact bar. Use **↑ Top / Show all** to return to the full search, location, Add and Sort controls. Filters from the compact bar returns to the top and opens the criteria. Existing filters and the bottom action-bar collapse state are retained.

Tap a thumbnail to open that venue's photos. Local photos have Previous/Next and a photo count; Close or Return exits. Provider photos retain attribution. If no photo is loaded, the venue details open with Retry rather than a blank viewer. Tap a venue name to select its bottom-bar actions; Open venue shows the full details.

This remains a local trial. Secure accounts and the existing provider photo/link retrieval issues are not fixed by this UI release. Physical iPhone testing remains necessary.


## v27 expanded release — location, provider links and compact list

This build replaces the earlier v27 Set Location-only package. App version remains 0.27.27 (the change list calls it 0.027.27); build identifier is 20260921.3 and the offline shell is v3.

- Set Location now offers the country and region geography lists independently of saved venues. Spain → Andalusia includes Córdoba, Granada and Málaga even with no saved places. City coverage uses bundled cities, saved venues and the online geography fallback where available; it is not a complete offline world-city database.
- Venue editing no longer auto-completes partial location text while you type. Literal choices take precedence over equivalent names. For Spain, Andalicia, Andalucia and Andalucía are normalised to Andalusia when editing/saving the venue. This does not bulk-rewrite other records.
- Edit Venue shows Google Place ID and TripAdvisor Location ID separately from their website links. Find Google match / Find TripAdvisor match uses the configured service. Check the name/address before selecting a match, then Save. Manual correction and clearing are supported. Provider searches require working service connections; no new API key is included.
- Compact venue rows share a fixed bottom action bar. The highlighted row and venue name show which venue the actions apply to. Scroll to change the active venue, or tap/focus a row to select it. Hide actions collapses the bar; Show actions restores it. Collapsing frees list space and remains in effect while scrolling. Empty results and map view hide the bar.

Permissions remain enforced through the existing Owner access rules. System Administrators have venue access in this local trial; in authenticated mode, they must also hold the existing Owner permission. This release does not grant broader server permissions.

Deployment: replace the deployed application files with this ZIP's contents, keeping index.html at the site root. Commit and push using your existing GitHub deployment workflow. Reload/reopen the app after deployment; the new service-worker shell updates the cached files. Because the displayed version remains 0.27.27, the earlier v27 version-number check may report up to date. Confirm this build by the collapsible bottom bar and Google Place ID field. Do not clear site data. No Worker or database migration is required.


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

## v29 changes

- Málaga remains selectable under Spain → Andalusia, including after clearing filters or when no venues match. Andalucía/Andalucia and the reported Andulucia spelling resolve to Andalusia.
- Location fields retain unfinished typing during background refreshes. Partial city names are completed on selection, Enter or leaving the field, not by a typing timer.
- Add stays available for permitted accounts in the compact header and Archive. Adding from Archive returns to active Places.
- Archive has a Back to Places button. Opening My Settings returns to active Places without changing identity or permissions.
- My Settings means your personal preferences. The current account and role remain shown above the settings tabs.

Update through Account → My Settings → Check for Update → Install Update. Confirm version 0.27.30. Do not clear browser/site data to update; this trial stores venues on the device.

## v30: visible location suggestions and Add venue

Type part of a location, then tap the suggestion directly below the field: Spai → Spain, Andal → Andalusia, Mala → Málaga. Suggestions also work in the Add venue form. They no longer depend on the browser's native suggestion strip. Arrow keys and Enter are supported.

Add venue is always visible on Places, including the compact scrolling header and Archive. Accounts allowed to edit open the form directly. Other accounts receive the existing sign-in or local-trial identity guidance; tapping Add never grants a role automatically. In the current local trial, choose Owner under Account → My Settings → Test role when acting as the Owner. My Settings itself does not switch identities.

Update using Account → My Settings → Check for Update → Install Update and confirm 0.27.30. Do not clear site data to update.


## Release 0.27.31

Corrects online-added venue location filtering. Matching user-selected country/region/city values survive Save Place. Missing locations on existing Google-linked venues are resolved in-session using exact Place IDs. See docs/QA_V0.27.31.md.
