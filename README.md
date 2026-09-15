# Pers Favourites PWA v027j

Version: 0.27.10  
Date: 16 September 2026

v027j is a corrective release focused on filter cascading, Add/Edit usability and regression QA. It does not require a database migration.

## v027i -> v027j

1. Keep the v027i package/commit as rollback.
2. Deploy the current `main` branch/static files.
3. Fully close and reopen the installed PWA, or use Account & Settings -> App Updates -> Check for Update / Install Update.
4. Confirm Version 0.27.10.
5. Confirm Country -> State/Region -> City/Town cascading on both the opening page and Add/Edit.

## Corrected filter behaviour

The opening-page filters now rebuild as a dependent set rather than as independent static lists. Country changes clear incompatible State/Region and City selections; State/Region changes clear City. Place Type, Cuisine, Meal / Visit Type, Great For, Feature, Dietary and Personal Tag choices are also rebuilt against the other active filters and the current search text so stale choices are not left behind.

Country, State/Region and City/Town use the browser-compatible Countries States Cities dataset through jsDelivr. The app keeps an on-device/saved-venue fallback if that geographic source cannot be reached. Geographic alias handling retains compatibility with names such as Andalucía/Andalusia, Catalunya/Catalonia and Illes Balears/Balearic Islands.

## Add / Edit corrections

The Add/Edit form no longer traps the user. The X and Cancel controls are explicitly non-submit buttons and Escape also closes the editor where supported.

Country, State/Region and City/Town are true cascading dropdowns. Place Type and Cuisine are also true dropdowns populated from standard choices plus values already present in the Pers catalogue. Multi-value fields (Meal / Visit Type, Great For, Features, Dietary and Personal Tags) now use an iPhone-friendly picker with removable chips instead of requiring comma-separated typing.

Find Place Online continues to populate the editor, and v027j now rehydrates the dropdowns after an online result is chosen so imported country/region/city/type/cuisine values are not lost.

## Additional stale-state fixes

Search changes, filter-chip removal, quick filters, Ask Pers results and archive/restore/permanent-delete paths all refresh dependent filter choices. The release also uses a new service-worker cache name (`pers-favourites-v027j-shell-v1`) so an installed PWA cannot silently continue serving the v027i shell after updating.

## QA added in v027j

`v027j.js` includes structural and geographic self-checks exposed as `window.PERS_QA_027J` for browser diagnostics. The repository also contains `tests/qa-v027j.mjs` and `.github/workflows/qa.yml`, covering:

- JavaScript syntax checks for the principal app files.
- Version consistency across config, service worker and `version.json`.
- Required filter/editor DOM IDs.
- Country -> State/Region -> City/Town reset/cascade wiring.
- Add/Edit X and Cancel non-submit behaviour.
- Add/Edit dropdown and multi-picker presence.
- Search/dependent-filter rebuild wiring.
- A representative Spain/Australia cascade regression model.
- Runtime geographic checks for Spain, Andalusia, Balearic Islands, Granada, Málaga, Australia, Victoria and Melbourne when the geographic dataset is reachable.

## App Updates

Account & Settings includes Current version, Latest available, Check for Update and Install Update. Pers reads `version.json` without the service-worker cache. Venue data, ratings and settings remain in their existing local/database storage across app updates.

## Google Maps / Places

The secure Google connection-management design from v027h is retained. The PWA does not store the server-side Google API key. Owner/Admin key-management actions call the configured secure worker endpoint.

## Ask Pers

Typed and microphone speech input are retained. Ask Pers returns controlled Pers filters/search terms rather than unrestricted database queries.
