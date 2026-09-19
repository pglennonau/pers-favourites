# Pers Favourites — Owner Guide

Version: **0.27.23**

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

The Cloudflare Worker is the authoritative API-call counter. The default v0.27.23 control design is:

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

Cloudflare is the approved backend/service direction for Pers Favourites. Current v0.27.23 Pers catalogue data remains local, while Cloudflare is used for authorised external-service routing and usage safeguards. Future shared storage/auth/photos are intended to use Cloudflare components.

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
