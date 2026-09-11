# Pers Favourites PWA v026

Version: 0.26.0

This folder is the GitHub Pages deployment package. For a normal software update, upload the CONTENTS of `deploy` to the existing GitHub repository for that rollout. Do not create a new repository just because the software version changes.

## What v026 adds

- Venue-photo galleries and cover photos.
- Owner/Admin photo uploads appear immediately.
- Ordinary viewers open/search/filter/map without a login.
- A viewer who chooses to contribute a photo uses a secure email sign-in link at that point and still gains no venue-edit permission.
- Viewer photos are PENDING until Owner/Admin approval, so users cannot make new public photo content appear without moderation.
- Owner/Admin can approve, hide, change captions, set a cover photo and permanently remove venue photos.
- Owner has the strongest rights: only Owner can change the collection identity, restore a local backup, or permanently delete an archived venue. Owner can also turn new user photo contributions on/off.
- Venue cards and venue detail screens use approved photos; pending/hidden photos do not appear to other Viewer users.
- A Google reviews & photos action opens the stored Google Maps venue link when available.
- v026 uses a warmer, more colourful interface while keeping the existing simple filter/navigation layout.
- Local Test mode stores photo files in IndexedDB and includes local photo files in v026 JSON backups.
- Production mode uses a rollout-specific Supabase Storage bucket named `venue-photos`, isolated inside that rollout's own Supabase project. Approved images use public delivery URLs so normal browsing remains login-free; pending/hidden metadata is not exposed to signed-out viewers.

## Modes

- `mode: "local"`: local trial on one browser/device. Place data is stored locally; photo metadata is stored with the app data and compressed photo blobs are stored in IndexedDB.
- `mode: "supabase"`: production/shared rollout. Active venue data and approved photo metadata are public/read-only; Owner/Admin controls use email/password authentication; user photo contribution uses a secure email link. Every rollout MUST have its own separate Supabase project.

## Existing production rollout: v025.1 -> v026

Before deploying v026 application files, run `supabase/migration_v025_1_to_v026.sql` in the EXISTING Supabase project for that rollout. This creates the v026 photo table/storage bucket, enables login-free read-only browsing, and tightens the Owner-only master controls. Then deploy the v026 files. Do not run the migration against another owner's project.

## New production rollout

1. Create a new Supabase project for this rollout only.
2. Run `supabase/schema.sql` in its SQL editor.
3. Set `app_settings.deployment_id` exactly equal to the unique `deploymentId` in `config.js`.
4. Create the Owner/Admin accounts and assign their profile roles as shown at the end of the schema.
5. Configure password-recovery and magic-link redirect settings in Supabase.
6. Copy `config.example.js` over `config.js`, enter this rollout's unique settings, and set `mode: "supabase"`.
7. Commit the deployment files to this rollout's GitHub repository and enable GitHub Pages over HTTPS.

Use only the browser-safe Supabase publishable key in `config.js`. Never place a service-role or other secret key in GitHub.

## Photo moderation model

Viewers can browse without signing in. If they choose to add photos, they identify themselves by a secure email link but still cannot add/edit venues. Their photos are forced to `pending` by both application logic and database policy. Owner/Admin can make a photo visible by approving it, hide it again, edit its caption, make it the venue cover, or remove it. A Viewer can remove their own uploaded photo. The Owner can override and manage all visible catalogue content and can turn off new user photo contributions at any time.

## Update/data rule

Application code and rollout data remain separate. Replacing GitHub files must not delete the rollout's Supabase database or Storage bucket. Each different owner/city rollout gets a different GitHub repository/site AND a different Supabase project.
