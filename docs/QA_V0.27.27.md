# Pers Favourites v0.27.27 — expanded release QA

Build 20260921.3. Compared against the preceding saved v0.27.27 Set Location-only archive. This replaces that package while retaining the requested v27 app version. Earlier baseline evidence remains available in prior file versions.

## Changes delivered

1. Country/region choices no longer depend on saved venues; Andalusia and its bundled cities can be selected with no matches. Online city lookup supplements the bundled geography where available.
2. Literal location choices take precedence, partial editor text is not auto-completed, and Spain's Andalicia/Andalucia/Andalucía values are canonicalised to Andalusia on venue edit/save. No bulk data rewrite.
3. Google Place ID and TripAdvisor Location ID are visible and editable in Edit Venue. Provider match searches show identifying details for confirmation; selected IDs and links persist, and IDs can be cleared.
4. Compact venue rows use a shared action bar driven by Intersection Observer and explicit selection. It collapses to a slim control, stays collapsed while scrolling and reserves only its measured height. Map/empty views hide it. Photo retry remains available in venue details; the compact row shows a short No photo placeholder when loading fails.

## Verification

- JavaScript syntax check passed.
- Release integrity suite: 115 passed, zero failures.
- Frontend suite: 134 passed with jsdom and mocked provider services. Includes existing sorting, filters, taxonomy, geographic cascade, photos/attribution, rating roles, archives, modal Return controls and new location/provider/bar cases.
- Worker suite: 15 passed, zero failures. Worker files unchanged.
- Real headless Chromium checks passed at 390 × 844 mobile and 1280 × 900 desktop viewports. Screenshots inspected. Verified scroll-driven selection, collapse/expand, correct Open venue target, no-results state, and region/Google ID persistence after reload. No uncaught browser errors.
- Mobile action bar measured 123 px expanded and 35 px collapsed (88 px reclaimed).
- Existing config, deployment ID, storage keys and backend permissions preserved. No database migration.
- Archive contents checked for root index.html, required assets and byte equality with the validated build; no repository metadata or test-user data packaged.

## Practical limits

- Chromium mobile emulation is not a physical iPhone Safari test. Confirm touch/keyboard behaviour on the deployed device.
- Live Google/TripAdvisor calls were not made. Search success still depends on the configured service, credentials and quotas. Provider matching was verified with mocks.
- City coverage is bundled + saved + available online geography, not an exhaustive offline city database.
- Authenticated System Administrators need the existing Owner permission to edit venue data. Local trial System Administrators already have that access; this release does not broaden server permissions.
- Same-version update: the old 0.27.27 version comparison can say up to date. Deploy the replacement files and reload/reopen; the new shell-v3 service worker refreshes assets. Do not clear site data.
- Not deployed to GitHub Pages by this build task.
