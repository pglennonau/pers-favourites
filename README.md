# Pers Favourites PWA v027h

Version: 0.27.8  
Date: 16 September 2026

Upload/deploy the contents of this folder to the live GitHub Pages/static HTTPS deployment. Preserve rollout-specific values in `config.js`, including deploymentId, Supabase URL and the browser-safe Supabase publishable key.

## Existing v027g rollout -> v027h

1. Export a fresh full backup and retain the v027g GitHub commit/package.
2. Run `supabase/migration_v027g_to_v027h.sql` against the current Supabase database.
3. Replace the deployed static PWA files with this package, preserving rollout-specific `config.js` connection values.
4. Deploy/update `cloudflare/places-search-worker.js`.
5. Configure the Cloudflare Worker values described below.
6. Publish and fully close/reopen the installed PWA.
7. Confirm Version 0.27.8.
8. Sign in as Owner/Admin -> Account & Settings -> External Services - Google Maps / Places; save/test the endpoint and configure the Demo key.
9. Test Find Place Online and Ask Pers using both typed and spoken input.

If upgrading from v027e or v026, apply the older database migration first (`supabase/migration_v027e_to_v027f.sql` or `supabase/migration_v026_to_v027f.sql`), then apply `supabase/migration_v027g_to_v027h.sql` as appropriate before deploying v027h.

## Google Maps / Places: secure v027h connection management

The PWA does not store the server-side Google API key. Owner/Admin key-management actions call the Cloudflare Worker over HTTPS.

The Worker needs normal runtime values for Supabase identity/role verification:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `ALLOWED_ORIGIN` (set to the exact live Pers HTTPS origin where practical)

For Owner/Admin Replace/Remove API Key actions, configure the following one time:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_WORKER_SCRIPT_NAME`
- `CLOUDFLARE_API_TOKEN` as a Worker secret, using a restricted token with the minimum Workers Scripts Write permission needed for this Worker.

The Google values managed by the Worker are:
- `GOOGLE_PLACES_API_KEY` - encrypted Worker secret
- `GOOGLE_PLACES_MODE` - `demo` or `production`

In Pers:
1. Owner/Admin -> Account & Settings -> External Services - Google Maps / Places.
2. Save the Worker HTTPS endpoint.
3. Tap Test Connection.
4. Tap Replace API Key, choose Demo or Production, enter the key and save.
5. The app displays only a masked hint after saving. It never reads the raw stored secret back.

When moving from the Google Demo Key to a production key, use Replace API Key and select Production. No PWA reinstall or venue/database re-import is required.

## Ask Pers: written or spoken input

When Ask Pers is enabled, the dialog retains the normal text entry field and adds a microphone button. Supported browsers transcribe speech into that same field. The user reviews/edits the text and then taps Search Pers. If the browser speech-recognition API is unavailable, use the device keyboard dictation microphone instead.

## Find Place Online

v027g search corrections remain in v027h:
- visible provider/connection state;
- `Brutus Restaurant` normalizes to `Brutus`;
- accent-tolerant fallback matching for names such as Breogan/Breogán;
- explicit Search Wider and Search Google Maps options;
- database-driven Country -> State/Region -> City filters.
