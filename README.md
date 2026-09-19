# Pers Favourites PWA

Version: **0.27.20**  
Date: **19 September 2026**

Pers Favourites is a curated PWA catalogue. Normal catalogue search/filtering searches **Pers data only**. Google Places is an Owner/System Administrator enrichment service used when adding or matching venues; it is not a replacement for the Pers catalogue.

## 0.27.20 update

### Opening screen

- Removes the large opening-screen quick-action button row.
- Keeps optional presets in one compact **Quick filter** selector inside **Filters**.
- Makes **Location** explicit and compact: tap **Set location / Change**, then choose **Country → State/Region → City/Town** and tap **Done**. The controls collapse after selection.
- **Places** and the venue list now sit directly under the compact location/toolbar area rather than being pushed below large shortcut controls.
- When **Remember my filters** is off, Pers opens showing all saved places. The last location may still be retained as context for Find Place Online, but it is not silently reapplied as an opening catalogue filter.
- Location/filter choices immediately re-render the count, list and map.

### User / Owner / System Administrator separation

**User**
- Browse/search/filter the Pers catalogue.
- Set personal Near Me radius and filter-memory preference.
- Rate venues and contribute photos where Owner permits.
- Check/install PWA updates.

**Owner**
- Controls Pers data and collection presentation: add/edit/archive/delete venues, Pers ratings, photo moderation, import/export, collection name, Owner name, default Near Me radius and whether Ask Pers/user photos are enabled.
- Does not receive technical Google/Cloudflare configuration controls.

**System Administrator**
- Controls technical/system functions: Google Places/Cloudflare endpoint and API-key connection management, Ask Pers technical endpoint, technical import/export and diagnostics.
- Does not receive private Owner commercial/payment controls merely because of the technical role.
- System Administrator assignment is intended to be protected backend administration, not something an Owner can self-assign in the PWA.
- Owner controls whether Ask Pers is enabled; System Administrator controls the Ask Pers technical endpoint.

During the local trial, the test identity selector remains available so Pat can test Owner and System Administrator paths. It is explicitly test-only and hidden in production mode.

### Production role hardening

The Supabase source now supports separate `owner`, `sysadmin`, legacy `admin`, and `viewer` roles plus a protected multi-role field. This allows Pat to hold **System Administrator + temporary Owner access** during setup, then have Owner access removed at handover while retaining technical rights.

Direct browser role changes are blocked. Owner collection settings and System Administrator technical endpoints use separate scoped RPCs rather than a shared unrestricted settings update.

For an existing production/shared Supabase rollout, apply:

`supabase/migration_v02719_to_v02720.sql`

before enabling the new production role model. The current local trial does not require this migration.

### Cloudflare / Google Places

The Worker source now tolerates both the older D1 usage-counter schema and the newer `bucket / call_count / updated_at` schema. This prevents an old D1 table from taking Google Places offline after a Worker update.

The live D1 database was repaired separately during testing. Copying this repository to GitHub does **not** automatically redeploy the Cloudflare Worker; redeploy Worker source only when intentionally updating Cloudflare.

### Photos

- Users have an obvious **+ Add photos** action on venue details when contributions are enabled.
- Owner retains approval/moderation control.
- Up to four approved Pers photos can be selected/reordered for venue banners. The previously wired but missing Move earlier/later routine is implemented in this build.
- If no approved Pers banner photo exists, the app can request a temporary Google Places fallback photo via the deployed `/photo` Worker; initials remain the final fallback.

## Known items not falsely represented as complete

- True production **Passkey/WebAuthn / Face ID** authentication is not implemented by this local-trial build. Password-manager biometric autofill is not treated as a passkey.
- Photo crop/reposition controls are not yet implemented; current photo controls cover approval, cover/banner selection, ordering, caption and removal.
- The compact Quick filter presets are retained as fixed presets in this build; full Owner editing of arbitrary preset names/order/criteria remains a separate enhancement.

## Update / deployment

1. Export a current device backup before a material update.
2. Replace the existing GitHub working-folder files with this version's files, preserving the repository itself.
3. Commit and push to the existing `pglennonau/pers-favourites` `main` branch.
4. On the PWA, use **☰ → User → App Updates → Check for Update → Install Update**.
5. Confirm the displayed version is **0.27.20** and verify existing venues remain present.

## 0.27.20 acceptance checks

1. Opening screen has no large quick-action button row.
2. **Places** is visible high on the opening screen and all venues appear when no filters are active.
3. Tap **Set location**, choose Country then State/Region then City/Town, and confirm the catalogue updates immediately.
4. With **Remember my filters** off, close/reopen and confirm the catalogue is not silently restricted to the previous location.
5. Open **☰ → Account & Settings** and confirm three areas: **User / Owner / System Administrator**.
6. User cannot open protected Owner/System Administrator controls in production without the appropriate authenticated role.
7. Owner can change collection settings but cannot manage Google/Cloudflare or the Ask Pers technical endpoint.
8. System Administrator can manage technical endpoints but does not automatically gain Owner content-edit rights in production.
9. Verify **Find Place Online** still finds Massamore Pizzeria after the repaired Cloudflare/D1 backend.
10. For a Google-linked venue with no Pers photos, verify the temporary Google photo fallback is attempted.

## Core file discipline

Keep two current master deliverables for each release: the deployable PWA package and the consolidated Master Documentation. Older versions should be treated as archive/history, not as parallel current copies.
