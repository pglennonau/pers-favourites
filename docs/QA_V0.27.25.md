# Pers Favourites v0.27.25 draft QA audit

20 September 2026. Base: v0.27.24, commit `7999c8673bc18c8d1667e9bd326f9c31df07284b`.

## Release assessment

The draft repairs several concrete photo/rendering problems and adds the requested collapsible summary. It is **not ready for confidential Owner information or real account activation**. Email/password authentication, password recovery and shared catalogue storage remain unfinished. A frontend-only GitHub release cannot provide them.

This is a source audit, automated regression run and targeted live desktop inspection, not a claim that every feature or device has passed. The user's phone database and uploaded photo blobs were not available. The exact Casa El Pimpo incident cannot yet be proven to have one particular cause.

## Changes verified in this draft

| Finding | Change | Verification |
| --- | --- | --- |
| Sorting rebuilt every image area | Preserve the venue's existing photo area through sorting and adding records, including external result cards | DOM identity checks and no additional photo request on sort |
| Photo responses and cache could outlive a venue edit | Include venue identity in provider cache keys; reject stale responses | Delayed response after identity change returns no photo |
| Google fallback could select a different provider ID with the same name | Match the saved provider ID; without it, require an unambiguous name/location match | Mismatched ID and ambiguous candidates rejected |
| TripAdvisor fallback could use the first unrelated result | Remove arbitrary first-result matching; require one name/location match | Source inspection; live TripAdvisor remains unconfigured |
| Saving a provider photo could compete with another loader | Seed transient photo cache before rendering; use the regular loader | Actual Save Place preserves another venue's existing photo |
| Duplicate photo IDs in an import could point to another venue's blob | Refuse cross-venue ambiguous IDs; include venue on image metadata | Ambiguous blob lookup returns no image |
| Expanded selection summary occupied too much space | Add Show/Hide details, remembered preference and accessible expanded state | Collapse, expand, rerender and preference persistence checked; filters retained |
| Missing coordinates were interpreted as zero by map filtering | Reuse valid coordinate validation for map and bounds filtering | Source inspection plus null coordinate regression |

No stored provider photo references were added. Provider attribution/source/report links remain present. Missing or ambiguous photos show an unavailable state instead of substituting another venue's image.

## Automated checks

| Suite | Result | What this establishes |
| --- | --- | --- |
| JavaScript syntax | Pass | Modified application parses |
| Release checks | 104 passed, 0 failed | Required files, version consistency, markup references and source assertions |
| Worker unit checks | 15 passed, 0 failed | Mocked service parsers and usage safeguards |
| Frontend interaction checks | 67 passed | Sorting/filtering, photo identity, errors/retry, summary state and existing role/archive behaviours |

Commands, run from the repository:

```sh
node --check app.js
node qa/release-check.mjs
node qa/worker-unit.mjs
NODE_PATH=/workspace/scratch/3fec9ab22a51/test-runtime/node_modules node qa/frontend-check.cjs
```

For another machine, install `jsdom@30.1.0` in the test environment and set NODE_PATH accordingly. The release workflow already installs it. Source assertions are not end-to-end acceptance tests; merely finding a button or function does not prove it works.

The interaction suite covers all seven sort choices and their rendered order, twelve filter controls, clear-filter chips, provider-source visibility, missing GPS, null coordinates, Google attribution, provider failure/retry, photo preservation during actual Save Place, two photo requests completing in reverse order after a sort, an edited venue's late response, ambiguous photo IDs, the four-photo banner limit, viewer edit visibility, owner exclusion from user averages and archive visibility. Services and geolocation are mocked.

## Live inspection

The existing live v0.27.24 site opened successfully. Account & Settings showed `OWNER · owner@local.test`. Clicking the Administrator padlock kept it locked and displayed: switch to the System Administrator test identity. The desktop modal was readable and scrollable. These observations confirm the reported lock and the local trial state; they do not validate production permissions.

The live browser showed a Don Pepe Google photo with attribution. Two synthetic test venues without location showed a location-unavailable error. This does not prove that Golden Stack, the user's Don Pepe record or Casa El Pimpo have correct photos on the user's device.

## Outstanding functionality and risks

| Priority | Area | Evidence / effect | Required next work |
| --- | --- | --- | --- |
| Blocker | Secure accounts | Sign-in, magic-link, recovery and password change functions throw not-enabled errors | Implement and provision the account plan in ACCOUNT_SETUP.md |
| Blocker | Temporary Owner | No authoritative temporary grant, expiry or revocation | Server-enforced temporary membership and handover tests |
| Blocker | Shared data and private data | Production data loading and photo storage are stubs; trial roles live on the device | Shared authenticated store, public/private separation, migration and device tests |
| High | Saved provider location/name | Persistence guard strips unedited provider fields and can reuse an earlier search label | Reproduce broad-search → Add to Pers → reload; require a clear user-owned label and resolve permitted live details by provider ID. Do not remove provider persistence rules as a shortcut |
| High | Backup restore integrity | Restore catches photo writes without reporting individual failures; checkpoints are not a complete blob backup; duplicate record IDs need broader validation | Atomic/validated restore, missing-photo report, duplicate-ID checks and recovery tests before production migration |
| High | Cost controls | Settings values are local; Worker limits are separately configured | Clearly distinguish recorded budgets from enforced limits; implement authoritative updates if UI control is required |
| High | Google key management | Worker admin route deliberately returns 403 | Continue using Cloudflare secrets; only enable an app administration route after server authentication exists |
| Medium | Missing venue photos | Wrong-match fallbacks are now rejected; missing location, service quota and absent provider photos still cause unavailable states | Check the actual records/provider IDs and user photo blobs; a photo cannot be guaranteed for every venue |
| Medium | TripAdvisor | Unconfigured/disabled service is expected to return no results | Provision entitlement, credentials and allowance before live testing |
| Medium | Ask Pers | Requires a configured endpoint; none supplied in default settings | Implement and configure it or leave disabled with a clear status |
| Medium | Imported identifiers | Some existing markup interpolates IDs directly | Validate imported IDs and complete output escaping before accepting untrusted shared data |
| Verification | Mobile layout and PWA | Current-turn live visual inspection was desktop v0.27.24 | Test draft on iPhone Safari and installed PWA; portrait/landscape, keyboard, long labels, one-to-four images, updates and offline restart |

## Remaining acceptance pass

1. Test the draft with a copy of the affected collection: Don Pepe, Golden Stack, Gran Bar and Casa El Pimpo; sort repeatedly while photos are loading and while switching filters and sources.
2. Test local photo upload, moderation, cover selection, one/two/three/four image layouts and rapid photo-viewer switching on a real browser with IndexedDB. The DOM suite does not exercise image decoding or iOS storage behaviour.
3. Test reload/offline/update recovery, import, full photo backup and restore in a disposable collection. Never overwrite the only copy of the phone's data for QA.
4. Complete all account, recovery, revocation and cross-device tests in ACCOUNT_SETUP.md before adding confidential information.

No claim is made that there is no further functionality required. The unresolved items above are explicit release work, not cosmetic improvements.
