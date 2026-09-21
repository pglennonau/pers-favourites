# Pers Favourites — Change List v0.027.27

Updated: 21 September 2026

## 1. Allow location selection without saved venues

Status: Implemented in build 20260921.3; automated and Chromium browser checks completed.

Issue: Set Location currently builds its country, region and city suggestions from active saved venues only. This prevents selection of valid locations such as Andalusia when no saved venue records that region.

Required change:
- Use the full available geography lists for Country → State/Region → City/Town, supplemented by saved venue locations.
- Allow Spain → Andalusia → Córdoba, Granada or Málaga even when no venues are saved there.
- Recognise Andalusia and Andalucía as the same region.
- Keep type-to-search suggestions and the cascading selections working.
- Show “No saved places” when the selected location has no saved venues; retain the selected location.
- Keep location choices available when other filters return no results.

Acceptance checks:
- With no Andalusian venues saved, select Spain, Andalusia and each of Córdoba, Granada and Málaga.
- Confirm both Andalusia and Andalucía resolve to the same region.
- Confirm changing country resets region and city, and changing region resets city.
- Verify typing, suggestion selection, Clear, Done and Hide, including on mobile.
- Confirm existing venue filtering continues to work.

Version reference: This change list uses the requested label 0.027.27. The existing code archive identifies itself as 0.27.27; the expanded build 20260921.3 now includes the items in this list and replaces the earlier archive.

## 2. Venue region correction reverts — The Coffee Club Cordoba

Status: Implemented in build 20260921.3; reported spelling correction verified through save/reopen and persistence checks. The exact original device event sequence was not available.

Report: Editing The Coffee Club Cordoba and replacing “Andalicia” with “Andalusia” reverts to “Andalicia”. Exact point of reversion (during typing, on leaving the field, or after saving) is not yet confirmed.

Code findings: Region input uses automatic suggestion matching while typing, on change and on blur. Geography matching treats Andalucía/Andalucia and Andalusia as equivalent and returns the first matching option rather than prioritising the literal selected spelling. “Andalicia” is not in the explicit alias table. These are investigation leads; the exact reported reversion has not yet been reproduced.

Required change:
- Ensure a deliberate valid region correction is retained when leaving the field, saving, reopening the venue and reloading the app.
- Prevent suggestion matching or asynchronous geography refreshes from overwriting the intended correction.
- Use consistent region naming for English/Spanish equivalents while retaining correct geographic filtering.
- Investigate and correct the reported misspelling without silently rewriting unrelated location data.

Acceptance checks:
- Reproduce with The Coffee Club Cordoba, starting with the reported region “Andalicia”.
- Change to Andalusia by typing and by selecting a suggestion; verify persistence after blur, Save, reopen and reload.
- Separately test Andalucía/Andalucia → Andalusia.
- Confirm Córdoba remains selectable under Spain → Andalusia and the venue appears under those filters.

## 3. Consistent Google Place ID and TripAdvisor Location ID controls

Status: Implemented in build 20260921.3; automated and Chromium browser checks completed.

Issue: Edit Venue exposes TripAdvisor Location ID, but Google Place ID is captured from Google search results and stored without a visible editor field. The Google Maps link is a separate value, not the Google Place ID.

Required change:
- Show both Google Place ID and TripAdvisor Location ID to authorised Owner/System Administrator accounts in the venue editor.
- Provide a way to find, confirm and correct each linked provider venue.
- Populate the corresponding ID when a provider search result is selected, and retain it on save and reopen.
- Clearly distinguish provider IDs from Google Maps and TripAdvisor website links.
- Keep technical ID management out of ordinary User controls and enforce permissions when saving changes.

Acceptance checks:
- Verify both IDs are visible to authorised Owner/System Administrator accounts and unavailable for ordinary Users to edit.
- Test finding and selecting the correct provider venue, correcting an existing association, saving, reopening and reloading.
- Confirm a Google Maps link alone is not presented as a Google Place ID.
- Confirm unrelated venue edits preserve existing IDs, provider links and associated functionality.

## 4. Compact venue list with one contextual bottom action bar

Status: Implemented in build 20260921.3; automated and Chromium browser checks completed.

Design: Replace repeated action buttons on each venue card (such as Open venue) with one fixed bottom action bar. Reduce row height so more venues fit on screen and the list is easier to scroll.

Required change:
- Use compact rows retaining the venue name and essential summary information, with a smaller thumbnail where appropriate.
- Remove repeated action-button groups from list rows; place applicable actions in a shared fixed bottom bar.
- Clearly identify the active venue by name in the bar and highlight its row.
- Use Intersection Observer with the actual scrolling container as its root (or the viewport when appropriate). Configure an activation band near the top of the visible list using rootMargin; select the active row deterministically when multiple rows intersect.
- Update the shared bar as scrolling changes the active venue. Explicit row selection and keyboard focus must also select the venue and update the bar.
- Keep Open venue available in the bar and preserve applicable existing actions and role permissions. Clearly handle unavailable links.
- Make the bottom action bar collapsible with a clearly visible collapse/expand control. In its collapsed state, reduce it to a slim handle and reclaim the released height for the venue list, allowing another venue row to fit where screen size permits. This refers to displaying an additional row, not creating a new venue.
- Preserve the collapsed state while scrolling and changing the active venue; do not automatically expand it on observer updates. Expanding restores actions for the current active venue.
- Reserve bottom space matching the current expanded/collapsed height and respect mobile safe areas so the bar does not cover the last venue or other controls.
- Handle the first and last rows, fast scrolling, filters, sorting, list/map changes and empty results without retaining an incorrect venue target.
- Keep the selected target stable during button activation so a concurrent observer callback cannot redirect an action to another venue.
- Disconnect and rebind observers when list contents change. Provide a usable explicit-selection fallback where Intersection Observer is unavailable.

Acceptance checks:
- Compare visible row count and scroll usability with the previous layout on mobile and desktop.
- Verify observer selection and every bar action target the named venue during slow/fast scrolling and at list boundaries.
- Verify touch, mouse and keyboard selection, visible focus and active-row indication.
- Check filtering, sorting, no results, map/list switching and returning from venue details.
- Verify collapse/expand by touch, mouse and keyboard, with an accessible label and expanded-state indication. Confirm collapsing actually increases the visible list area and does not leave an empty reserved gap.
- Confirm scrolling while collapsed preserves that state, and expanding targets the current active venue.
- Confirm the final row remains fully reachable above the bar in both states and role restrictions remain enforced.

## Release completion

Built as app 0.27.27, build 20260921.3. This replaces the earlier v27 archive. All four items are implemented; 134 frontend checks, 115 release checks and 15 Worker checks pass. Chromium mobile/desktop checks pass. Live provider services and physical iPhone Safari remain deployment checks. City lists are not an exhaustive offline worldwide database. Authenticated System Administrators retain the existing requirement for Owner permission to edit venues. Updated guides and QA evidence are included in the code ZIP. Not deployed.
