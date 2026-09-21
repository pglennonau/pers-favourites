# Pers Favourites v0.27.26 QA

Date: 21 September 2026. Local-trial UI/bug-fix release; not approval for confidential information.

## Changes and regression evidence

- Reproduced a failed list photo followed by a successful detail lookup. Successful retrieval now updates every connected frame with the same venue identity and supersedes pending attempts. Attribution remains attached. Existing sort/add/edit identity and out-of-order response tests remain in place.
- Saved venue cards use Open venue, Directions, Website, Call, Book, TripAdvisor in fixed order, plus Edit for authorised roles. Missing details are disabled, never fabricated. Verified saved website/telephone links remain actionable.
- Pers and User rating summaries share structural markup and five-star presentation, including fractional User averages. Owner/viewer edit permissions and separate personal voting controls are unchanged.
- Prominent Filters chevrons collapse the selection details, preserve the compact summary and saved preference; Edit filters remains a separate control.
- All 12 dialogs have one bottom Return button using existing close handlers. Tests verify each closes without submitting a form.
- Mobile inputs use at least 16px text; dialogs respect dynamic viewport height; map sizing refreshes after dialog close. Pinch zoom is not restricted. These are safeguards, not proof of the reported iPhone issue's root cause.

## Automated gate

- `node --check app.js`
- `node qa/release-check.mjs`: 115 checks.
- `node qa/worker-unit.mjs`: 15 tests; no Worker modifications.
- `NODE_PATH=<jsdom installation>/node_modules node qa/frontend-check.cjs`: 107 checks, mocked services and disposable browser storage; no paid provider requests.

Version pins cover scripts, styles and service-worker shell. Updates must preserve local data.

## Open limitations / acceptance

- Test the actual affected venues on iPhone Safari and the installed PWA after updating. Automated tests do not inspect Pat's phone collection or prove a provider has usable photos.
- Server-side demo search/photo allowance is unchanged. A successful UI fix cannot override an exhausted allowance. TripAdvisor remains dependent on configuration/entitlement.
- Missing persisted provider fields require separate work respecting provider-data restrictions (OA-09). Disabled controls communicate absent details; they do not populate them.
- Secure accounts, editable verified recovery email, server-enforced temporary-owner revocation and shared data are not implemented. Administrator Open Actions OA-01–06 and OA-15–17 remain blockers before confidential use.
- Full real-device backup/restore, untrusted import hardening and phone layout acceptance remain open in the Administrator appendix. This release does not certify every existing feature.
