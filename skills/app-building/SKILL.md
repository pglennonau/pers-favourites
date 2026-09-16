# App Building Skill

## Purpose

Use this skill for feature work, bug fixes, refactors, releases, deployment changes, and QA on Pers Favourites and similar web/PWA applications.

The objective is not merely to make code compile. The objective is to deliver behaviour that works in the deployed application on the user’s actual device class, without accumulating fragile corrective layers.

## Core principles

1. **Fix the base implementation, not the symptom.**
   - Do not add runtime corrective overlays, monkey patches, late-loaded replacement handlers, or version-specific scripts to compensate for flawed base code.
   - If the base architecture is wrong, refactor the base architecture.
   - Compatibility code is acceptable only when it is a deliberate data/schema migration with a clear removal path.

2. **Quality before speed.**
   - A smaller, verified release is preferable to a larger release with untested interactions.
   - Do not declare a bug fixed because the relevant function exists or because source text contains expected strings.

3. **Test behaviour, not just code presence.**
   - Syntax checks and static assertions are necessary but insufficient.
   - Functional changes require interaction tests that exercise the real UI flow.
   - For iPhone/PWA behaviour, include WebKit-oriented testing where practical.

4. **Treat deployed behaviour as the truth.**
   - Verify the committed source, CI result, deployment result, and live/deployed application separately.
   - PWA/service-worker caching must be considered part of the application, not an afterthought.

5. **Preserve user data.**
   - Never casually change localStorage/database keys, schema, or field semantics.
   - Before migrations, identify existing stored formats and provide deterministic migration/rollback behaviour.

6. **Use semantic versioning.**
   - Patch release: `0.27.11` for bug fixes/refinements without intentional breaking behaviour.
   - Minor release: `0.28.0` for meaningful new capabilities.
   - Major release: `1.0.0` when production stability and support expectations justify it.
   - Do not use letter suffixes such as `027j` for releases.

7. **Keep the Library current.**
   - Every completed app release must have a corresponding current-version package and/or release documentation prepared for the user’s ChatGPT Library.
   - Do not assume a file is in Library merely because it exists in GitHub, a chat, a Project, or a temporary sandbox.
   - Library status is a release-tracking item that must be explicitly verified.

## Standard workflow

### 1. Reproduce and define the problem

Before changing code:

- Identify the exact user path that fails.
- Inspect the current implementation rather than assuming what it does.
- Distinguish among:
  - UI markup problem
  - state-management problem
  - event-wiring problem
  - data problem
  - asynchronous/race problem
  - service-worker/cache problem
  - deployment problem
  - browser/device-specific problem
- Write a short acceptance statement in plain language.

Example:

> Selecting Spain on the opening page must limit State/Region to Spain; selecting Andalusia must limit City/Town to Andalusian cities; Place Type and Cuisine must then show only choices available in the currently matching Pers venues.

### 2. Choose the clean architecture

Ask:

- Which layer should own this behaviour?
- Can the behaviour be implemented once, directly, rather than overlaid later?
- Is the data source appropriate for the use case?

For Pers Favourites specifically:

- **Opening-page filters** filter the Pers catalogue and therefore should derive their options from the current Pers venue data.
- **Add/Edit venue geographic controls** create new data and therefore may use the complete Country → State/Region → City/Town dataset.
- Taxonomy controls should use controlled lists plus existing stored values where backward compatibility requires it.

### 3. Change the real source files

For functional UI work:

- Put permanent controls directly in `index.html` or the appropriate component/template.
- Put permanent state/event logic directly in `app.js` or the appropriate application module.
- Remove superseded workaround code from the active load path.
- Avoid duplicate implementations of the same behaviour.

Before completing a refactor, search for stale references to:

- previous version numbers
- old event handlers
- old element types/IDs
- old cache names
- previous workaround scripts
- obsolete documentation

### 4. Preserve state and compatibility

For each change, check:

- Existing venue records still load.
- Existing ratings, photos, preferences and settings still load.
- Existing values not present in a new controlled list are preserved and displayed rather than silently discarded.
- Imported/online-found venues can hydrate the same controls used for manual Add/Edit.
- No data is deleted because a dropdown cannot recognise an old value.

### 5. QA layers

Every functional release should pass all applicable layers below.

#### Layer A — syntax and structural checks

- JavaScript parser/syntax checks.
- Required DOM elements exist.
- Version consistency across config, version metadata and service worker.
- No missing imports/resources.

These checks are **not** sufficient to call the feature working.

#### Layer B — deterministic unit/regression logic

Test important pure logic such as:

- cascading option reduction
- filter combination rules
- alias/normalisation behaviour
- state reset behaviour
- data migration behaviour

#### Layer C — browser interaction tests

Use a real browser automation framework where practical. Exercise the actual controls.

Minimum tests for filter/editor work:

- Open app.
- Seed representative sample venues.
- Select Country.
- Verify State/Region options change.
- Select State/Region.
- Verify City/Town options change.
- Verify Place Type and Cuisine choices change against current matches.
- Clear/change a parent filter and verify invalid child selections are removed.
- Open `+ Add`.
- Verify the editor uses real dropdowns where specified.
- Verify Country → State/Region → City/Town cascade inside Add/Edit.
- Verify Cancel closes without saving.
- Verify X closes without saving.
- Verify Escape closes where supported.
- Verify Save persists the intended values.
- Reopen the saved venue and verify values round-trip correctly.

#### Layer D — WebKit/mobile-oriented tests

For PWA/iPhone-sensitive work:

- Run interaction tests under WebKit where possible.
- Check native `<select>` behaviour.
- Check dialog opening/closing.
- Check focus and scrolling within modal forms.
- Check that buttons inside forms have explicit `type` values.

#### Layer E — deployed smoke test

After deployment:

- Confirm the live version number.
- Confirm the service-worker cache version changed when required.
- Reload/reopen in a way representative of an installed PWA.
- Exercise the exact user-reported failing path on the deployed site.
- Do not say “fixed” until the deployed path has been verified or clearly state what has and has not been verified.

## PWA/service-worker rules

- Treat the service worker as release-critical code.
- Each release that changes shell files should use an intentional new cache identifier.
- Remove obsolete files from the shell list.
- `version.json` or equivalent update metadata should bypass stale cache.
- Validate upgrade behaviour from the immediately previous release.
- Preserve application data across code updates.

## UI control rules

- Use native semantic controls when they fit the task.
- For a fixed single choice, prefer `<select>` over free text.
- For dependent geography, disable child controls until the parent is selected.
- When a parent changes, clear child values that are no longer valid.
- For multi-select concepts on iPhone, use an explicit picker plus removable selected chips rather than comma-separated typing.
- Always provide a clear escape path from modal/editor screens.
- Buttons inside forms must specify `type="button"` unless they intentionally submit.

## Filter rules

Dependent filters should behave as a coherent system.

When computing choices for one filter:

- Apply all other active filters.
- Ignore the current filter’s own value while computing its available choices.
- Include search text where search is part of the same result set.
- Remove or clear selections that become impossible after another filter changes.
- Keep counts consistent with the rows that would actually match.

Geographic hierarchy:

- Country controls State/Region.
- State/Region controls City/Town.
- Changing Country clears incompatible State/Region and City/Town.
- Changing State/Region clears incompatible City/Town.

## Library and release-artifact handoff

Library management is part of release completion, not an optional housekeeping task.

For every app release:

1. Identify the canonical release version using semantic versioning.
2. Prepare the current release artifacts with unambiguous filenames, for example:
   - `Pers_Favourites_0.27.11.zip`
   - `Pers_Favourites_Release_Notes_0.27.11.pdf` or `.md`
   - current Owner/Setup/Instruction Manual files when those documents changed.
3. Treat GitHub as the source-code system and ChatGPT Library as the user-facing retained-file system. A GitHub commit does **not** count as a Library save.
4. Save the new current-version artifacts to Library when a Library write capability is available in the current environment.
5. After saving, verify the Library item exists and is the intended version before reporting that Library is updated.
6. Superseded releases should be clearly marked/archive-managed rather than mixed with the current release. Do not delete historical versions unless the user explicitly requests deletion.
7. Maintain one obvious current version. Do not leave multiple similarly named “final”, “latest”, `final2`, or letter-suffix copies that make it unclear which release is authoritative.
8. If a Project also needs the artifact as a Source, handle that separately; Project Sources and Library are not interchangeable.
9. If the current tool environment cannot write to Library, do **not** claim that the file was saved there. Instead:
   - create/provide the final versioned artifact where possible;
   - state plainly that the Library handoff remains outstanding;
   - give the user the minimum necessary upload step;
   - retain the canonical version/name in release notes so the handoff can be completed later without ambiguity.
10. Before declaring a release completely finished, report Library status as one of:
   - `Library: verified current`
   - `Library: not required for this change`
   - `Library: outstanding — no Library write capability in this session`

For Pers Favourites, the preferred Library organization is a clear app-specific location such as `Pers Favourites`, containing the current release package and current user documentation, with older versions archived or clearly identified as superseded.

## Release discipline

For meaningful functional changes:

1. Inspect current code and live behaviour.
2. Implement in base code.
3. Remove superseded workaround paths.
4. Run syntax/static QA.
5. Run logic/regression QA.
6. Run browser interaction QA.
7. Review the diff for accidental unrelated changes.
8. Update semantic version.
9. Update service worker/cache as required.
10. Update concise release notes.
11. Deploy.
12. Verify the live application.
13. Complete and verify the Library/release-artifact handoff.

Prefer a branch + CI + reviewed diff for substantial changes. Tiny documentation-only edits may go directly to the default branch.

## Definition of done

A change is done only when:

- The implementation is in the correct base layer.
- No superseded runtime workaround remains active.
- Existing user data remains compatible.
- Automated QA passes.
- The principal user interaction path has been tested in a real browser.
- Mobile/WebKit risk has been tested when relevant.
- Deployment succeeds.
- The deployed application reports the intended version.
- The exact reported defect no longer reproduces in the deployed application, or any remaining verification limitation is stated explicitly.
- Required release artifacts have a clear canonical version and filename.
- Library status has been explicitly verified or explicitly reported as outstanding because the current environment cannot write to Library.

## Communication rules

- Report concrete findings early when debugging.
- Distinguish clearly between “code changed”, “CI passed”, “deployed”, “user-path verified”, and “Library verified”.
- Never represent static/source checks as equivalent to real functional QA.
- Never claim a file was saved to Library without verifying that save.
- If a release still has a known risk, state it rather than masking it with confidence language.
- Keep release notes focused on user-visible behaviour, architecture changes, migration impact and known limitations.

## Lessons incorporated from Pers Favourites development

The following failures should not recur:

- A later-loaded version script replacing broken base event handlers.
- Add/Edit fields remaining free-text in the base HTML while another script tries to convert them at runtime.
- QA that checks for strings/function names but does not exercise the UI.
- Declaring cascading controls fixed without testing them in the installed/deployed PWA.
- Form Cancel/Close controls accidentally submitting because `type="button"` was omitted.
- Service-worker caching causing a user to see behaviour different from the repository state.
- Version naming that obscures normal semantic release progression.
- Files being created in a chat or GitHub but then assumed to be safely retained in Library.
- Multiple poorly named versions making it unclear which file is current.
