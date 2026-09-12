# Pers Favourites PWA v027e

Version: 0.27.5

This is the deployment folder. Upload the CONTENTS of this folder to the existing GitHub repository for the rollout. Do not create a new repository just because the software version changes.

## v027e highlights

- Two distinct venue ratings: **Pers/Administrator Rating** and **User Rating**.
- User Rating is the average of ordinary viewer ratings only. Owner/Admin ratings are excluded by both UI and database rules.
- Administrator display name is configurable. Rights still come from the protected Owner/Admin account role; typing a name never grants rights.
- App/collection name is configurable and the PWA branding/manifest updates to match.
- **Find Place Online** searches near the device's current location first, then widens. Generic category words such as Restaurant/Cafe/Bar are treated as hints, which improves searches such as “Brutus Restaurant” in Mallorca.
- Online place results can populate address, coordinates, phone and official website where the source provides them.
- Optional **Ask Pers** natural-language search can be enabled by the Owner. The browser stores no OpenAI/API secret; it calls a configured server endpoint that may return only controlled filters/search terms.
- Import workflow now supports a single-venue test flow plus drag-and-drop/file-picker bulk import for CSV/JSON/GeoJSON/Google Takeout extracts.
- Administrator **full backup** export contains venue data, settings, ratings, visits, photo metadata and attempts to embed the actual photo files. Local-trial restore remains available in-app. Production restore is deliberately an Owner deployment procedure to avoid accidental destructive overwrite.
- Existing v026 photo moderation, Archive, version history, filters, map view and per-user personal details remain.

## Existing v026 production rollout -> v027e

1. Export a v026 backup first.
2. In the EXISTING rollout's Supabase SQL Editor, run `supabase/migration_v026_to_v027e.sql`.
3. Upload the v027e deployment files to the existing GitHub repository.
4. Keep the rollout's existing `deploymentId`, Supabase URL and browser-safe publishable key in `config.js`.
5. Hard refresh/reopen the PWA after deployment.

## New production rollout

1. Create one Supabase project for this rollout only.
2. Run `supabase/schema.sql`.
3. Set `app_settings.deployment_id` to exactly match `config.js`.
4. Create the Owner/Admin authentication accounts and set their `profiles.role` values.
5. Configure authentication redirect/recovery URLs.
6. Copy `config.example.js` to `config.js` and enter the rollout settings. Use only a browser-safe Supabase publishable key.
7. Deploy over HTTPS (GitHub Pages is suitable for the static PWA).

## Rating security model

`places.pers_rating` is editable by Owner/Admin through the protected editor role. `venue_ratings` accepts ratings only from authenticated `viewer` profiles. A database trigger rejects Owner/Admin attempts to enter User Ratings. `venue_rating_summary` is public read-only so signed-out users can see the average without exposing private notes.

## Backup model

The Administrator backup is a JSON package intended to preserve the complete logical collection: places, settings, ratings, visits, personal data available to the signed-in administrator, photo metadata, and photo binaries encoded in the backup where they can be retrieved. Large photo collections can create a large backup file. Keep backups securely because they can contain private notes and contribution metadata.
