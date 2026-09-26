# Pers Favourites — v0.27.33 release notes

## Version 0.27.33 — 26 September 2026

- **Starts as User:** the first v33 launch selects the User test identity, including when updating an existing trial. Your venues, photos, ratings and each identity's personal data are retained. Later explicit test-role selections persist across restarts. User is read-only for shared venue editing.
- **Owner rating in Add/Edit:** choose Not rated or 1–5 stars directly in the form. Cancel leaves the saved rating unchanged. The Owner rating remains separate from individual User ratings and their average.
- **Complete the venue after saving:** Save opens venue details, where photos, Favourite, Want to Visit, Visited and Private note are available. Owner/list notes and Must try remain in Add/Edit. Private notes are separate from shared Owner notes.
- **Open a venue:** tap its underlined name in the saved list, or use Open venue in the bottom action bar or map popup. The Open Now text is opening-hours information, not a button. External provider results remain in their labelled sections and a matching saved venue is excluded from those results.
- **New venue types:** Shopping, Jewellery, Police Station, Hospital, Dentist, GP Clinic, Supermarket, Fountains and Public Squares. These are added to existing installations while preserving custom types and archived choices. Searching for Jewelry also matches Jewellery.

### Trial roles and remaining work

There is **no secure Owner or System Administrator login yet**. To test protected editing, use Account → My Settings → Test role → Owner or System Administrator. The Add access prompt also offers explicit test-role selection. Select User to return to ordinary browsing and personal ratings. This is local trial behaviour, not production authentication. User venue suggestions/approval, verified individual accounts and shared cloud storage remain outstanding. The full provider name still requires a live lookup after restart; the independent saved label is used when unavailable.

### Update

Use Account → My Settings → Check for Update → Install Update. Confirm 0.27.33. Do not clear browser/site data. The Cloudflare Worker is unchanged; no Cloudflare upload is required for this release.

### Validation scope

This release uses targeted checks for changed controls, ratings and data preservation, the existing automated checks, and a live startup check. Earlier release notes below are historical. No new full-manual PDF has been generated.

