# Pers Favourites — Owner Guide

Version: **0.27.30**

## v28 navigation and photos

When scrolling, a compact bar keeps Places/count, List/Map and Filters available. Add and Sort are hidden only in this compact bar. Use **↑ Top / Show all** to return to the full search, location, Add and Sort controls. Filters from the compact bar returns to the top and opens the criteria. Existing filters and the bottom action-bar collapse state are retained.

Tap a thumbnail to open that venue's photos. Local photos have Previous/Next and a photo count; Close or Return exits. Provider photos retain attribution. If no photo is loaded, the venue details open with Retry rather than a blank viewer. Tap a venue name to select its bottom-bar actions; Open venue shows the full details.

This remains a local trial. Secure accounts and the existing provider photo/link retrieval issues are not fixed by this UI release. Physical iPhone testing remains necessary.


## v27 expanded release — location, provider links and compact list

This build replaces the earlier v27 Set Location-only package. App version remains 0.27.27 (the change list calls it 0.027.27); build identifier is 20260921.3 and the offline shell is v3.

- Set Location now offers the country and region geography lists independently of saved venues. Spain → Andalusia includes Córdoba, Granada and Málaga even with no saved places. City coverage uses bundled cities, saved venues and the online geography fallback where available; it is not a complete offline world-city database.
- Venue editing no longer auto-completes partial location text while you type. Literal choices take precedence over equivalent names. For Spain, Andalicia, Andalucia and Andalucía are normalised to Andalusia when editing/saving the venue. This does not bulk-rewrite other records.
- Edit Venue shows Google Place ID and TripAdvisor Location ID separately from their website links. Find Google match / Find TripAdvisor match uses the configured service. Check the name/address before selecting a match, then Save. Manual correction and clearing are supported. Provider searches require working service connections; no new API key is included.
- Compact venue rows share a fixed bottom action bar. The highlighted row and venue name show which venue the actions apply to. Scroll to change the active venue, or tap/focus a row to select it. Hide actions collapses the bar; Show actions restores it. Collapsing frees list space and remains in effect while scrolling. Empty results and map view hide the bar.

Permissions remain enforced through the existing Owner access rules. System Administrators have venue access in this local trial; in authenticated mode, they must also hold the existing Owner permission. This release does not grant broader server permissions.

Deployment: replace the deployed application files with this ZIP's contents, keeping index.html at the site root. Commit and push using your existing GitHub deployment workflow. Reload/reopen the app after deployment; the new service-worker shell updates the cached files. Because the displayed version remains 0.27.27, the earlier v27 version-number check may report up to date. Confirm this build by the collapsible bottom bar and Google Place ID field. Do not clear site data. No Worker or database migration is required.


## v26 interface update

The main-page **Filters** button expands/collapses the selection summary; **Edit filters** opens the criteria. All saved venue cards keep the same action positions. A disabled Website, Call, Book or TripAdvisor action means usable details are not saved; review the venue before entering verified details. Edit remains restricted to permitted roles.

Pers and User rating summaries now share the same layout; only authorised roles may change Pers's rating. User averages remain read-only, with separate personal voting controls. Every app dialog includes a bottom **Return** button. Returning from an editor without saving does not save edits.

Successful provider-photo recovery updates both the list and open venue. This does not override provider limits or guarantee a provider has a photo. No Cloudflare or spending-limit changes were made. Secure accounts remain outstanding; see the Administrator Open Actions appendix and [v26 QA](QA_V0.27.26.md).

This is the operating manual for the collection Owner. It is written for normal day-to-day use of Pers Favourites. Technical deployment, API secrets, Cloudflare configuration and recovery are handled in the System Administrator Guide.

## 1. What the Owner controls

The Owner controls the Pers collection itself. This includes:

- adding and editing venues;
- setting the Pers Rating;
- maintaining Place Type, Cuisine and other managed lists;
- approving, hiding, reordering and removing venue photos;
- importing and exporting collection data;
- archiving and restoring venues;
- permanently deleting a venue only from Archive;
- changing the collection/app name and Owner display name;
- deciding whether user photo contributions are allowed;
- deciding whether optional features such as Ask Pers are enabled;
- reviewing external-service usage and costs;
- approving or refusing paid use of external services.

Ordinary Users cannot edit the collection.

## 2. Opening Owner controls

1. Open Pers Favourites.
2. Tap the menu button at the top right.
3. Choose **Owner**.
4. In the current local test build, the test identity controls which protected areas are available. In a production rollout, Owner access must use a properly authenticated Owner account.

During setup/handover, the System Administrator may temporarily have Owner-level access so the system can be configured and tested. That temporary Owner permission is removed at handover while System Administrator access remains.

## 3. Collection settings

Under **Owner → Collection settings** you can manage:

- **App / collection name** — the public name of the collection. The configured name is also used for new Home Screen/PWA installs.
- **Owner display name** — the name shown beside the Pers Rating.
- **Home city/region** — the default descriptive home region.
- **Allow users to contribute venue photos** — enables or disables the contribution workflow.
- **Default Near Me radius** — default search radius.
- **Enable Ask Pers** — enables the user-facing natural-language search feature only when its technical endpoint has also been configured.

Tap **Save collection settings** after making changes.

## 4. Adding and editing a venue

### Add manually

1. Tap **+ Add**.
2. Enter the venue name.
3. Complete the relevant type, cuisine, location, address, contact and website fields.
4. Add Pers-specific information such as Must Try, notes and tags.
5. Review the details.
6. Tap **Save Place**.

### Find Place Online

Use **Find Place Online** when you want live provider information to help identify a venue.

Google Places is the preferred live source when connected. Google-supplied information is treated as live provider content. Pers can show it while you select a place, but unchanged Google content is not copied into the Pers-owned catalogue. The permitted Google Place ID may be retained so Pers can refresh live information later.

TripAdvisor results remain a separate provider section and are never blended with Google results.

### Editing

Open a venue, choose **Edit venue**, make the changes, then save. Owner-entered/edited Pers fields are treated as Pers content.

## 5. Ratings

Pers can show several distinct ratings:

- **Pers Rating** — set by the Owner.
- **User Rating** — average of ordinary User ratings; Owner/System Administrator ratings are excluded.
- **Google Maps/Places rating** — live provider-specific information where available.
- **TripAdvisor rating** — provider-specific information where authorised and available.

Provider ratings are not blended into the Pers Rating or User Rating.

## 6. Venue photos

The photo priority for cards and venue details is:

1. approved Pers photo;
2. live Google Maps/Places photo;
3. live TripAdvisor photo only if no usable Google photo is available and TripAdvisor access is active;
4. Pers placeholder.

### Owner photo moderation

Under **Owner → Manage venue photos**, the Owner can:

- approve pending User photos;
- hide photos;
- select/remove banner photos;
- change ordering;
- edit captions;
- permanently remove photos.

Owner uploads can appear immediately. User contributions require approval before they are shown publicly.

TripAdvisor and Google photos remain external provider content. They are not copied into the Pers photo collection.

## 7. Managed lists

Use **Owner → Manage lists** to maintain the values used by both Filters and Add/Edit.

The Owner/System Administrator can add, rename, reorder, archive and restore managed values. Renaming a managed item updates matching local Pers venue values.

Important lists include Place Type, Cuisine and other configurable filters.

## 8. Archive and permanent deletion

Normal deletion is a two-stage process.

1. Move a venue to **Archive**.
2. From Archive, either restore it or permanently delete it.

Permanent deletion is Owner-only. Make a current backup before permanently deleting important data.

## 9. Import and backup

### Import

Use **Owner → Import places**.

For a first test:

1. use the single-venue test import;
2. check the field mapping and result;
3. only then move to a bulk import.

The bulk importer accepts supported extracted Google Takeout/CSV/JSON/GeoJSON files. Do not select the original Takeout ZIP itself.

The import workflow previews data and checks for possible duplicates.

### Export

Use **Export full backup** before a material update, major import or destructive change.

The current local test stores Pers collection data in the browser/device. A backup is therefore important before changing devices, browsers or deployments.

## 10. Costs & Payments

Under **Owner → Costs & Payments**, each external service has its own card.

Current cards cover:

- Google Places / Google Maps;
- TripAdvisor;
- Cloudflare;
- OpenAI / Ask Pers;
- future paid services as they are added.

Where the provider makes the information available, the Owner card should show:

- connection status;
- mode or plan;
- current usage;
- free allowance;
- allowance/reset period;
- estimated or known charges;
- whether paid use is authorised;
- the Owner spending/budget cap;
- a secure **Manage billing** link.

Pers is not a payment processor. It must never store a full card number, CVV/security code or provider password.

### Owner spending caps

The Owner can record Pers-side spending caps for Google, TripAdvisor, Cloudflare and OpenAI/Ask Pers. These records are an Owner control and do not replace provider-side budgets. Where the provider supports a native budget/cap, the System Administrator should configure that as well.

## 11. TripAdvisor cost safeguard

TripAdvisor API use is optional.

The Cloudflare Worker is the authoritative API-call counter. The default v0.27.25 control design is:

- warning at **50%** of the configured free allowance;
- automatic API pause at **95%** of that allowance;
- allowance amount is configurable;
- allowance period is configurable and must match the actual TripAdvisor account entitlement;
- paid use must not start silently.

The Owner can record approval for paid TripAdvisor API use. That approval alone does not activate paid calls. The System Administrator must also mirror the Owner approval into the protected Cloudflare Owner-approval flag and separately enable paid usage. Both protected server-side gates must be true before the Worker can pass the free cutoff.

The direct **View on TripAdvisor** link remains usable even when TripAdvisor API calls are paused.

## 12. Google Places cost safeguard

Google Places has separate Demo and Production modes.

- Demo mode uses the conservative trial limits configured in the Worker.
- Production mode requires explicit production minute/day safeguards before calls are permitted.

The Owner can see mode/usage status. The System Administrator controls the protected Cloudflare configuration.

## 13. Cloudflare and OpenAI/Ask Pers

### Cloudflare

Cloudflare is the approved backend/service direction for Pers Favourites. Current v0.27.25 Pers catalogue data remains local, while Cloudflare is used for authorised external-service routing and usage safeguards. Future shared storage/auth/photos are intended to use Cloudflare components.

### OpenAI / Ask Pers

The Owner decides whether Ask Pers is enabled. The System Administrator manages the technical endpoint and any server-side OpenAI credential. The API key must never be stored in the PWA.

## 14. App updates

Under **My Settings → App Updates** you can see the current version and check whether a newer release is available.

Before a material update:

1. export a current Pers backup;
2. confirm the System Administrator has the matching release package;
3. update the PWA and matching Cloudflare Worker together where the release changes Worker functionality;
4. confirm the displayed version after deployment.

## 15. Terms and privacy

The PWA contains public **Terms of Use** and **Privacy Policy** links in the footer. These pages describe current local storage, location use, Cloudflare routing and external-provider handling.

## 16. Owner handover

At final handover:

- Per uses his own Owner credentials;
- temporary Owner permission held by Pat/System Administrator is removed;
- Pat retains System Administrator rights;
- no shared generic Owner password is used;
- production protected access should use the approved authenticated-account model, including passkey/WebAuthn when implemented, with secure fallback/recovery.

## 17. When to contact the System Administrator

Contact the System Administrator when:

- an external service shows Not connected, Warning or Paused unexpectedly;
- a Google/TripAdvisor/OpenAI key or plan changes;
- Cloudflare Worker deployment is required;
- usage counters or budgets appear incorrect;
- the PWA release needs deploying;
- a backup/restore or recovery issue cannot be resolved from Owner controls;
- provider terms, pricing or quotas have changed.

The System Administrator Guide contains the complete technical instructions and is intended to include everything the Administrator needs to understand the Owner-facing system as well.

## v0.27.24 update

Cards now use compact ratings consistently, including cards with uploaded collages. Google photos can appear on saved and external cards; missing/failed provider photos show a message and retry button. No saved venue, photo or rating migration is required. A venue without a provider photo cannot be guaranteed a photo; add your own through Venue photos if desired.

Filters, sort and source selections remain visible above the results. Nearest asks for current device location; unknown values sort last. Saved Pers entries remain first. External entries cannot be sorted by a Pers/User rating or a personal visit date and use A–Z for those choices.


## v0.27.25 local-trial update

Photo areas now stay attached to their venues during sorting and adding places. Provider photo matching uses the saved provider ID where available and rejects ambiguous alternatives. The selections summary can be collapsed and expanded without clearing filters. Missing coordinates are excluded from the map.

This remains a local trial, with no secure email/password accounts. See [the QA audit](QA_V0.27.25.md) and [account implementation requirements](ACCOUNT_SETUP.md) for outstanding work.

## v29 changes

- Málaga remains selectable under Spain → Andalusia, including after clearing filters or when no venues match. Andalucía/Andalucia and the reported Andulucia spelling resolve to Andalusia.
- Location fields retain unfinished typing during background refreshes. Partial city names are completed on selection, Enter or leaving the field, not by a typing timer.
- Add stays available for permitted accounts in the compact header and Archive. Adding from Archive returns to active Places.
- Archive has a Back to Places button. Opening My Settings returns to active Places without changing identity or permissions.
- My Settings means your personal preferences. The current account and role remain shown above the settings tabs.

Update through Account → My Settings → Check for Update → Install Update. Confirm version 0.27.30. Do not clear browser/site data to update; this trial stores venues on the device.

## v30: visible location suggestions and Add venue

Type part of a location, then tap the suggestion directly below the field: Spai → Spain, Andal → Andalusia, Mala → Málaga. Suggestions also work in the Add venue form. They no longer depend on the browser's native suggestion strip. Arrow keys and Enter are supported.

Add venue is always visible on Places, including the compact scrolling header and Archive. Accounts allowed to edit open the form directly. Other accounts receive the existing sign-in or local-trial identity guidance; tapping Add never grants a role automatically. In the current local trial, choose Owner under Account → My Settings → Test role when acting as the Owner. My Settings itself does not switch identities.

Update using Account → My Settings → Check for Update → Install Update and confirm 0.27.30. Do not clear site data to update.
