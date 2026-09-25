# Pers Favourites — release 0.27.32

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

