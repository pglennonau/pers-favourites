# v0.27.29 QA

Baseline: origin/main f74ce39, app 0.27.28 build 20260922.1.
Release: 0.27.29 build 20260922.2.

All 162 frontend, 115 release-integrity and 15 Worker checks pass. JavaScript syntax passes. The same new focused-input refresh test fails against the preceding v28 checkout and passes against v29.

New checks cover partial Málaga typing; background option refresh; repeated clear/reselect with region aliases; zero results; saved venue matching; settings identity and location retention; archive deletion followed by My Settings; Add/open/save after that sequence; explicit Archive exit; Add from Archive; viewer and protected-role boundaries. Existing filter, cascading, lists, ratings, provider IDs, photo viewer, compact navigation and bottom-bar checks remain passing.

No Worker logic, authentication grants or persistent storage keys changed. Existing local-trial System Administrator access includes Owner capabilities; production role predicates still require Owner access for venue edits. This release does not introduce production authentication.

Physical iPhone Safari, the user's exact stored collection and live provider responses are not covered by simulated tests. Chromium live release smoke testing is performed after publication. Offline worldwide geography coverage remains limited to bundled/API-supported locations.
