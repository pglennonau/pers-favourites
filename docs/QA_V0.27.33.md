# v0.27.33 — targeted release checks

Baseline: v0.27.32 commit 92a6675d021fcaf4ddc8b2478141728fbb57a3b3. Date: 26 September 2026.

Per the user's instruction, use targeted checks and the existing automated checks, then one live startup check. Do not regenerate the full manual PDF or repeat broad manual reviews.

Completed locally:
- 25 targeted frontend assertions covering new/updated User defaults, preservation of venues/photos/private notes, retained explicit role choice, all nine types, custom/archived category preservation, Jewelry alias, Owner Add/Edit rating, Cancel, clear rating, unchanged fractional legacy rating, saved persistence, opening details after Save, clickable venue titles, opening-hours status, filtering, separate User ratings and denial of User catalogue edits.
- 212 existing frontend checks passed.
- 116 release-integrity checks passed.
- JavaScript syntax passed.

No Cloudflare Worker changes. Its unchanged test suite remains part of repository CI; no separate manual Worker review is required.

Limits: tests use mocked services. The original Artisan Coffee Roaster presentation on the user's device has not been reproduced; the saved-card, title-opening and opening-hours paths are checked. Production authentication, User suggestions/approval, cloud data sharing and full provider-name retention offline remain outstanding. Physical iPhone testing is not claimed.
