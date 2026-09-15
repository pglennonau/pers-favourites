# Pers Favourites PWA v027i

Version: 0.27.9  
Date: 16 September 2026

Upload/deploy the contents of this folder to the live GitHub Pages/static HTTPS deployment. Preserve rollout-specific values in `config.js`, including deploymentId, Supabase URL and the browser-safe Supabase publishable key.

## v027h -> v027i

1. Keep the v027h package/commit as rollback.
2. Replace the deployed static PWA files with this package, preserving rollout-specific `config.js` connection values.
3. No database schema migration is required for v027i.
4. Fully close/reopen the installed PWA and confirm Version 0.27.9.
5. Test Country = Spain -> State/Region -> City/Town.
6. Open Account & Settings -> App Updates -> Check for Update. It should report 0.27.9 is current.

If a production rollout is still on v027g, apply the existing `supabase/migration_v027g_to_v027h.sql` first because that migration belongs to the v027h Google connection feature. v027i adds no further database migration.

## v027i geographic cascade

The Country, State/Region and City/Town filters now use the browser-native Countries States Cities data package through jsDelivr, loaded only when needed. The dropdowns are no longer limited to locations already present in saved Pers venues. Stored venue geography is merged into the choices and remains the fallback if the geography service is unavailable.

Changing Country clears incompatible State/Region and City selections. Changing State/Region clears City. The filter still returns Pers venues only; selecting a geographic area with no saved Pers venues correctly returns no results.

## App Updates

Account & Settings includes Current version, Latest available, Check for Update and Install Update. Pers also performs a silent update check when opened. The update mechanism reads `version.json` without using the service-worker cache. When a newer release has already been published to the host, Install Update refreshes the service worker and reloads the PWA.

Publishing is still a developer/administrator action: the new release files must first exist on GitHub/Cloudflare. End users then update from inside Pers without deleting/reinstalling the Home Screen PWA. Venue data, ratings and settings remain in their existing storage/database.

## Google Maps / Places

v027h secure Google connection management is retained unchanged. The PWA does not store the server-side Google API key. Owner/Admin key-management actions call the Cloudflare Worker over HTTPS.

## Ask Pers

v027h typed and microphone speech input is retained. Supported browsers transcribe speech into the Ask Pers text field; where direct browser speech recognition is unavailable, the device keyboard dictation microphone can be used.
