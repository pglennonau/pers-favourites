# Pers Favourites PWA

Version: 0.27.11  
Date: 16 September 2026

0.27.11 is a quality-focused corrective release. Cascading filters and Add/Edit dropdowns are implemented directly in the base application. The former `v027j.js` runtime corrective layer has been removed.

## What changed

### Opening-page filters

The opening filters now operate as one dependent system against the actual Pers catalogue.

- Country limits State/Region.
- State/Region limits City/Town.
- Place Type, Cuisine, Meal / Visit Type, Great For, Feature, Dietary and Personal Tag choices are rebuilt against the other active filters and current search text.
- Invalid child selections are cleared when a parent selection changes.
- Filter choice counts are based on the catalogue rows that can actually match.
- Search and result filtering use the same normalized text matching so accents do not create inconsistent choices versus results.

The opening page deliberately derives choices from Pers venue data rather than the worldwide geography database. This keeps catalogue filtering deterministic and useful offline.

### Add / Edit venue

Add/Edit now uses native controls defined directly in `index.html`.

- Place Type and Cuisine are native dropdowns.
- Country → State/Region → City/Town is a native cascading sequence.
- Add/Edit geography uses the master Countries/States/Cities source, with existing Pers venue values retained as a fallback for compatibility.
- Existing or legacy taxonomy values are preserved even when they are not part of the standard controlled lists.
- Meal / Visit Type, Great For, Features, Dietary and Personal Tags use picker-plus-chip controls rather than comma-separated typing.
- A new Add form is explicitly reset, so values from a previously edited/cancelled venue are not carried forward.
- Find Place Online rehydrates the same permanent editor controls; it does not bypass them.

The Close (×) and Cancel controls are explicit non-submit buttons. Escape also closes the editor where supported.

## Architecture cleanup

0.27.11 removes the previous version-specific runtime correction architecture.

- `v027j.js` has been removed.
- The late-loaded overlay from `config.js` / `config.example.js` has been removed.
- The permanent logic now lives in the base `app.js` and permanent controls live in `index.html`.
- Existing localStorage/database keys and venue data formats remain unchanged.
- No database migration is required for this release.

## QA

The release gate now includes multiple layers rather than relying on source-text checks alone.

1. JavaScript syntax checks.
2. Structural/version/regression checks.
3. Deterministic cascade regression checks.
4. Playwright interaction tests using an iPhone WebKit profile.

The WebKit tests exercise the actual user paths:

- Spain → Andalusia/Balearic Islands cascading.
- Andalusia → Granada/Malaga cascading.
- dependent Place Type and Cuisine choices.
- search-driven filter choices.
- parent changes clearing invalid child geography.
- native Add/Edit dropdowns.
- Add/Edit master geography cascade.
- multi-value chip add/remove.
- Cancel and × closing without saving.
- fresh Add forms not retaining cancelled Type/Cuisine values.
- Save and Edit round-trip of venue values.

A regression guard also protects the existing Recently Visited sort while the filter/editor code is being refactored.

## PWA update behaviour

The service-worker shell cache is `pers-favourites-0.27.11-shell-v1` and no longer includes the obsolete corrective script. `version.json` remains network-fetched so the App Updates screen can detect the release without being trapped behind an old shell cache.

Existing Pers venue data, ratings, photos, preferences and settings continue to use their existing storage keys and survive application updates.

## Updating an installed PWA

Use:

**☰ → Account & Settings → App Updates → Check for Update → Install Update**

After reopening, confirm **Version 0.27.11**.

For acceptance testing, first check the exact corrected paths:

- On the opening page choose Spain, then verify only Spanish regions appear.
- Choose Andalusia, then verify Granada/Malaga rather than Palma/Melbourne.
- Change Place Type/Cuisine and confirm available choices adjust to the current catalogue matches.
- Open + Add and confirm Country → State/Region → City/Town cascades there as well.
- Confirm Cancel and × close without creating a venue.

## Other retained capabilities

The existing security/roles, Owner/Admin controls, user ratings versus Pers rating, photos/moderation, Archive, backup/version history, import, Ask Pers, Find Place Online, Google Maps/Places connection management, map view and venue actions remain part of the application.

For engineering and release discipline, see `AGENTS.md` and `skills/app-building/SKILL.md`.
