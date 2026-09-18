# Pers Favourites PWA

Version: **0.27.17**
Date: 18 September 2026

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

## 0.27.15 update
- Home quick actions now include Coffee and remove Tonight.
- Near Me and Coffee force a fresh device location before filtering; default radius is 1 km and users can choose 250 m, 500 m, 1 km, 2 km, 5 km or 10 km.
- Import is moved from the catalogue into protected role management.
- Account & Settings is separated conceptually into My Settings, Owner and System Administrator responsibilities.
- Venue photo contribution remains available to users from venue details, subject to Owner moderation.
- Up to four approved photos can be selected for the venue banner; the banner falls back to initials when no Pers photo exists.
- Google Places photos are intended as a temporary compliant fallback once the deployed Worker photo endpoint is enabled; they are not copied into Pers storage.
- Passkey/WebAuthn is the target protected-authentication method for production. The local trial still uses its existing local-role/test authentication path; no biometric data is stored by Pers.

## 0.27.17 update
- Country, State/Region and City/Town are prominent per-User location filters. Each committed change immediately refreshes the result count, catalogue and map.
- Opening quick actions begin Near Me, Favourites, Want to Visit, Coffee and 5 Star, followed by the remaining actions in their prior order.
- 5 Star includes a place when the Pers/Owner rating is exactly 5.0 or the non-Owner User Rating average is 4.5 to 5.0.
- All selected banner photos appear on both the opening catalogue card and venue detail, using split/collage layouts for two to four photos.
- When no approved Pers photo exists, the app may show an attributed Google Places photo without copying it into Pers storage; initials remain the safe final fallback.
- Account & Settings verifies the configured Google Places service instead of falsely reporting a disconnected local trial.
- New Home Screen installs use the Owner-controlled App / collection name. Remove and reinstall an existing icon to refresh its label.
