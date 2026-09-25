# Pers Favourites 0.27.32 — release checks

Date: 25 September 2026. Baseline: deployed 0.27.31, commit f510741f7590cab195b8722ed3ebdac0bae69b42.

- Frontend interaction suite: 211 checks passed using jsdom with mocked service responses.
- Release and packaging structure: 115 checks passed.
- Existing Cloudflare Worker suite: 15 tests passed; Worker implementation unchanged.
- JavaScript syntax: passed.
- Combined Owner, System Administrator and User guide: 37 PDF pages rendered and visually inspected.

New coverage includes exact provider-ID duplicates despite renamed venues; normalised name/address matching; distinct businesses at one address; self-edit exclusion; edit collisions; archived matches; concurrent Save and Import; same-batch import duplicates; provider-ID import preservation; review of existing duplicates without deletion; full selected live name on cards/editor; exact-ID name recovery after reload; independent saved-label capitalisation; deliberate Owner rename persistence; dedicated read-only Add guidance; explicit test-role choice resuming Add; Administrator Add from Archive.

An older clear-provider-ID test now clears the provider URLs as well. Leaving a URL containing another venue's exact Place ID correctly triggers the new duplicate guard.

## Limits and outstanding acceptance

Mocked tests do not prove provider availability, physical iPhone behaviour or production authentication. The full Google name requires a live lookup after restart; offline full-name retention is not complete. Secure individual accounts and shared cloud storage remain unimplemented. Cloudflare dashboard access was blocked by repeated security verification. No authentication, recovery or production permission tests are claimed as passed.

The former layout concern is closed at the user's request; no layout redesign was made.
