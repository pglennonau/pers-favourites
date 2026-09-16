# Pers Favourites PWA

Version: **0.27.12**  
Date: 16 September 2026

0.27.12 corrects the geography controls reported during iPhone testing. It is a patch release and does not change the Pers database schema or localStorage keys.

## What changed

### Searchable geography on the opening page

Country, State/Region and City/Town are now searchable single-choice fields rather than long scrolling selectors. Start typing a name such as `Spa` and Pers resolves it to **Spain** when it is the unique match. A small typo such as `Spsin` is also resolved when there is one clear match.

The opening filters continue to show geography that actually exists in the Pers catalogue. Selecting Country rebuilds State/Region from matching Pers venues; selecting State/Region rebuilds City/Town. Changing a parent clears an incompatible child selection.

### Searchable geography in + Add / Edit

The same type-to-search interaction is used when adding or editing a venue. Add/Edit uses the master country/region geography data and keeps an on-device fallback (`geo-fallback.js`) so iPhone PWA operation does not depend on a third-party geography CDN being reachable. Existing stored venue geography is preserved and merged into choices.

### Retained 0.27.11 behaviour

Controlled Place Type and Cuisine selectors, picker/chip multi-fields, safe Cancel/× handling, archive/restore, ratings, photos, import, Ask Pers, Google Places connection controls, App Updates, backups and existing Pers data remain compatible.

## Update

Use **☰ → Account & Settings → App Updates → Check for Update → Install Update** after 0.27.12 has been published to the live static deployment. Existing venues, ratings, photos, preferences and settings are preserved.

## Acceptance test

1. On the opening page type `Spa` into Country and choose/resolve **Spain**.
2. Confirm State/Region immediately offers only regions present in saved Spanish Pers venues.
3. Choose **Andalusia** and confirm City/Town offers the matching saved cities such as Granada/Malaga.
4. Open **+ Add**. Type `Spa` or `Spsin` into Country and resolve **Spain**.
5. Choose **Andalusia**, then **Granada**, save the venue, reopen it and confirm all three values round-trip correctly.

No database migration is required from 0.27.11.
