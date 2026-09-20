# Pers Favourites — System Administrator Guide

Version: **0.27.25**

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
- **Active Pers catalogue storage in v0.27.25:** local browser/device storage.
- **Backend/service direction:** Cloudflare only.
- **Google Places:** PWA → Cloudflare Worker → Google Places API.
- **TripAdvisor:** PWA → Cloudflare Worker → authorised Tripadvisor Terra API.
- **OpenAI/Ask Pers:** future/optional server-side endpoint through Cloudflare.
- **Future shared catalogue/auth/photos:** Cloudflare D1/KV/R2/Workers as appropriate.
- Do not reintroduce the superseded backend.

## 4. Release source and file structure

The release branch for this version is:

`release/0.27.25`

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

TripAdvisor activation is optional for initial v0.27.25 deployment. If the developer/API account is not yet configured, leave `TRIPADVISOR_ENABLED=false`; the rest of the release can be deployed and tested normally.

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

Current v0.27.25 is a local-data/local-role test release. Production authentication remains a later Cloudflare-based implementation.

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

1. Confirm the source branch is `release/0.27.25`.
2. Confirm the branch is based on the correct preceding release.
3. Run JavaScript syntax checks.
4. Run `node qa/release-check.mjs`.
5. Run `node qa/worker-unit.mjs`.
6. Confirm the GitHub Actions **Pers Favourites Release QA** workflow is green.
7. Confirm version `0.27.25` in app/config/version file/service worker/UI.
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
19. Confirm the installed PWA displays `0.27.25`.

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


## v0.27.25 local-trial update

Local script and stylesheet URLs are pinned to v0.27.25, and service-worker installation revalidates cached files. Keep those version pins aligned in future releases so an update does not combine new HTML with older scripts. Install Update must preserve local venue/photo storage; do not clear site data to update the app.

Photo areas now stay attached to their venues during sorting and adding places. Provider photo matching uses the saved provider ID where available and rejects ambiguous alternatives. The selections summary can be collapsed and expanded without clearing filters. Missing coordinates are excluded from the map.

This remains a local trial, with no secure email/password accounts. See [the QA audit](QA_V0.27.25.md) and [account implementation requirements](ACCOUNT_SETUP.md) for outstanding work.

## Appendix A — Open Actions

This is the ongoing register of matters still to be completed, including items deliberately left until handover. Review it before each release and at handover. Keep completed items in the register and record the completion date and evidence; do not mark an action complete merely because its screen or button exists.

Status at this update: v0.27.25 is approved for deployment as a local-trial bug-fix release. Secure accounts and the recovery-email controls below are requirements, not activated features. Account email addresses have been supplied privately; verify them during provisioning rather than publishing them in this manual. Remaining account and confidential-use blockers are not waived by deployment.

### Before secure account activation

| ID | Open action | Responsible | Completion evidence | Status |
| --- | --- | --- | --- | --- |
| OA-01 | Provision authentication and the email service for account setup and password recovery; confirm Cloudflare configuration and approved return URLs. | Administrator | Setup, verification and recovery messages delivered successfully; secrets remain server-side. | Open |
| OA-02 | Create Per's permanent Owner account and Pat's account with Administrator plus Temporary Owner permissions. Both access the same collection through their own credentials. | Administrator, with Per | Each identity signs in successfully; direct API permission tests pass. | Open — account identities supplied |
| OA-03 | Initially use Pat's recovery address for Per, and implement a separate Recovery email field that Per can change. Require re-authentication and verification of the new address before it becomes active. Changing recovery email must not change Per's login email. | Administrator implements; Per controls changes | Verified change, failed/unverified change, recovery delivery and old-address rejection tests pass. | Open |
| OA-04 | Implement Per-controlled removal of Pat's Temporary Owner permission, with no automatic expiry of that role. Keep Pat's Administrator role separate. Normal login-session expiry still applies. | Administrator implements; Per authorises removal | Server denies Owner operations after revocation, including from an existing session, while Administrator access still works. | Open |
| OA-05 | Implement shared catalogue/photo storage, public/private separation and cross-device access. Remove reliance on local trial roles for protection. | Administrator | Two-device tests and unauthorised access tests pass; private fields cannot be retrieved through public responses, caches or exports. | Open |
| OA-06 | Complete password-change, recovery, session-revocation and audit-trail tests; protect against accidentally removing the last permanent Owner. | Administrator | Account acceptance tests recorded, including Owner recovery after loss of access. | Open |

### Before release acceptance

| ID | Open action | Responsible | Completion evidence | Status |
| --- | --- | --- | --- | --- |
| OA-07 | Verify the photo fixes against a safe copy of the affected collection: Don Pepe, Golden Stack, Gran Bar and Casa El Pimpo. Test adding, editing and sorting while photos load. | Administrator, with Pat | Each image remains attached to the correct venue; unavailable images have a clear explanation. | Open — automated draft checks passed; actual collection check pending |
| OA-08 | Test mobile layouts and functions on iPhone Safari and the installed PWA: filters, cascades, sort, summary collapse, map, keyboard, long labels and one-to-four-photo layouts. | Administrator, with Pat/Per | Device checklist and any remaining defects recorded and resolved. | Open |
| OA-09 | Resolve saved provider name/location behaviour after adding and reloading a venue, while preserving provider-data restrictions. | Administrator | Broad-search/add/reload tests retain the intended venue identity and obtain the correct live details. | Open |
| OA-10 | Validate full backup and restore, including photo files, missing-file reporting, duplicate identifiers and safe recovery. Back up the existing collection before any migration. | Administrator | Successful restore into a disposable collection with matching record/photo counts and associations. | Open |
| OA-11 | Clarify which spending limits are enforced by the server and which are only recorded locally. Keep API keys in Cloudflare; do not enable browser key management without protected server permissions. | Administrator; Per approves spending | Enforced limits tested and documentation/UI accurately distinguish budgets from safeguards. | Open |
| OA-12 | Confirm whether TripAdvisor and Ask Pers will be enabled. Configure authorised services and test them, or explicitly retain them as disabled/deferred. | Per decides; Administrator configures | Recorded decision; enabled services pass live tests, or disabled services show clear status. | Open — optional activation |
| OA-13 | Finish imported-identifier validation and output escaping before accepting untrusted shared data. | Administrator | Malformed import and markup-injection regression tests pass. | Open |
| OA-14 | Complete the release gate: resolve blocking defects, compare with the previous working version, verify documentation/package contents, deploy the approved build and check the installed version. | Administrator | QA evidence, approved release identifier and post-deployment checks recorded. | In progress — local-trial deployment authorised; device acceptance and secure-account release remain open |

### At handover — timing controlled by Per

| ID | Open action | Responsible | Completion evidence | Status |
| --- | --- | --- | --- | --- |
| OA-15 | Close out Pat's Temporary Owner access when Per decides it is no longer needed. Do not remove it automatically or merely because development is finished. Preserve Pat's Administrator access. | Per authorises and controls timing; Administrator verifies | Per's decision/date recorded; temporary grant removed; active-session and direct API tests confirm Owner access is gone. | Open — deferred until Per requests closure |
| OA-16 | Replace Pat's initial recovery address with an address controlled by Per before confidential Owner information is introduced. This is separate from removing Temporary Owner permission. | Per changes and verifies; Administrator verifies the process | Recovery goes only to Per's verified address; previous recovery links cannot restore access through Pat's address. | Open — handover prerequisite for confidential information |
| OA-17 | Confirm Per can independently sign in, recover access, manage the collection and create/restore a complete backup. Check that retained Administrator access cannot expose Owner-confidential information through the app or exports. | Per, supported by Administrator | Handover checklist signed off, backup verified and remaining optional actions explicitly accepted or deferred. | Open |

Important: removing Temporary Owner permission alone does **not** close the recovery route while Pat's address remains Per's recovery address. Both OA-15 and OA-16 must be checked before treating the Owner account as handed over for confidential use. Revocation cannot retract information already downloaded.

For each closure, record: action ID, completion date, person confirming completion, test/evidence reference and any accepted limitation. Add newly discovered matters here so they are not lost in chat or left only at the end of a QA report.
