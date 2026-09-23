# Release 0.27.31 QA

Base: live version 0.27.30, commit 47706fcc17e43596665b82d715b8e5ceef441b61.

Cause: Google persistence guard reverted online-populated geography to the blank pre-search form. Accent/region aliases alone did not fix blank saved fields.

Changes:
- Start new editor geography with current explicit filters.
- Retain that independently selected classification only when it matches the online result.
- Compare Spain/España/ES, Andalucía/Andalusia and Málaga/Malaga consistently.
- Recover existing missing geography by exact Google Place ID using current session data; do not persist provider content.
- Apply the same effective geography to list filtering, search and cascading filter options.
- Preserve v30 typeahead, Add controls, roles, photos, archive, ratings and storage keys.

Verification: 185 frontend interaction assertions, 115 release checks and 15 Worker tests passed locally. Regression includes the real Use online result → Save Place → filtered list path, saved record reload, existing cleared-location record, mismatched Place ID, wider-search city exclusion, offline failure, and no provider geography in persistence. Existing full frontend suite covers filters, cascades, roles, managed lists, navigation and photo handling.

Limit: the user's browser-local El Pimpi record is not remotely accessible. Regression uses a representative record and mocked provider responses. Existing missing locations require a successful live lookup each session; no location is guessed from the filter. No Worker redeployment required.
