# Pers Favourites — User Guide

Version: **0.27.27**

## v27 expanded release — location, provider links and compact list

This build replaces the earlier v27 Set Location-only package. App version remains 0.27.27 (the change list calls it 0.027.27); build identifier is 20260921.3 and the offline shell is v3.

- Set Location now offers the country and region geography lists independently of saved venues. Spain → Andalusia includes Córdoba, Granada and Málaga even with no saved places. City coverage uses bundled cities, saved venues and the online geography fallback where available; it is not a complete offline world-city database.
- Venue editing no longer auto-completes partial location text while you type. Literal choices take precedence over equivalent names. For Spain, Andalicia, Andalucia and Andalucía are normalised to Andalusia when editing/saving the venue. This does not bulk-rewrite other records.
- Edit Venue shows Google Place ID and TripAdvisor Location ID separately from their website links. Find Google match / Find TripAdvisor match uses the configured service. Check the name/address before selecting a match, then Save. Manual correction and clearing are supported. Provider searches require working service connections; no new API key is included.
- Compact venue rows share a fixed bottom action bar. The highlighted row and venue name show which venue the actions apply to. Scroll to change the active venue, or tap/focus a row to select it. Hide actions collapses the bar; Show actions restores it. Collapsing frees list space and remains in effect while scrolling. Empty results and map view hide the bar.

Permissions remain enforced through the existing Owner access rules. System Administrators have venue access in this local trial; in authenticated mode, they must also hold the existing Owner permission. This release does not grant broader server permissions.

Deployment: replace the deployed application files with this ZIP's contents, keeping index.html at the site root. Commit and push using your existing GitHub deployment workflow. Reload/reopen the app after deployment; the new service-worker shell updates the cached files. Because the displayed version remains 0.27.27, the earlier v27 version-number check may report up to date. Confirm this build by the collapsible bottom bar and Google Place ID field. Do not clear site data. No Worker or database migration is required.


## v26 navigation and venue cards

Use **Filters** with the double chevrons to expand/collapse the current selection details. The compact location/count/sort summary remains visible. Use **Edit filters** to change criteria.

Venue actions have a consistent order. Greyed-out actions mean details are unavailable, not that your tap failed. Pers and User ratings use matching layouts; your own vote is still separate. Use the bottom **Return** button to close an app subpage/dialog and return to the screen underneath. Unsaved editor changes are not saved by Return.

When opening a venue successfully retrieves a missing provider photo, its list photo updates as well. Retry remains available for failed loads. Provider limits still apply. Install v0.27.26 through the app update control; do not clear browser/site storage, which holds local-trial venues and photos.

This guide is for ordinary Users of Pers Favourites. You do not need an Owner/System Administrator account just to browse the collection.

## 1. Open Pers Favourites

Your Owner/System Administrator will give you the Pers Favourites web address.

1. Open the link in your normal phone or computer browser.
2. Wait for the collection to load.
3. The current collection name appears at the top of the screen.

The current v0.27.25 local rollout may show a **Local test** screen. Production browsing is intended to open without requiring an ordinary User login.

## 2. Add Pers Favourites to an iPhone Home Screen

Using Safari:

1. Open the Pers Favourites link in Safari.
2. Tap the **Share** button.
3. Scroll down and tap **Add to Home Screen**.
4. Check the displayed app name.
5. Tap **Add**.

The new icon appears on the iPhone Home Screen.

If the Owner later changes the collection name, an already-installed Home Screen icon may retain its old label depending on iOS. A new install uses the currently configured app/collection name.

## 3. Add Pers Favourites to an Android Home Screen

Using Chrome:

1. Open the Pers Favourites link in Chrome.
2. Open the Chrome menu.
3. Choose **Install app** or **Add to Home screen** (wording can vary).
4. Confirm the displayed name.
5. Tap **Install/Add**.

## 4. Browse the collection

The main screen shows the saved Pers places.

You can switch between:

- **List** view;
- **Map** view.

Use the sort menu for options such as Nearest, User rating, Pers rating, Recently added, Recently visited, A–Z and Price.

## 5. Search

Use the main search box to search the Pers collection by venue name and other indexed Pers information.

Clear the search using the × button.

## 6. Set your location

The Location area lets you narrow the collection by:

1. Country;
2. State/Region/Province;
3. City/Town.

Start typing rather than scrolling through long lists. The State/Region options depend on the selected Country, and City/Town options depend on the selected State/Region.

Tap **Done** when the location is correct. Use **Clear** to return to all locations.

## 7. Filters

Tap **Filters** to open the catalogue filters.

Available filters can include:

- Place Type;
- Cuisine;
- Rating;
- Distance;
- Open Now;
- Price;
- meal/use-case/features and other managed fields.

Quick filters include common choices such as Near Me, Coffee, Favourites, Want to Visit, Restaurant, Wine Bar and 5 Star.

Use **Reset filters** to clear active filters.

## 8. External results

Pers Favourites remains the primary collection.

If external sources are enabled, results appear in separate sections:

- **Pers Favourites** — the Owner's curated collection;
- **More places from Google** — live Google Maps/Places results;
- **TripAdvisor results** — live TripAdvisor results when that service is active.

Google and TripAdvisor results are not blended together.

A direct **View on TripAdvisor** link can still work even when TripAdvisor API searching is paused.

## 9. Ratings

A venue can show several separate ratings:

- **Pers Rating** — set by the Owner;
- **User Rating** — average of ordinary User ratings;
- **Google Maps rating** — live provider-specific rating where available;
- **TripAdvisor rating** — provider-specific rating where authorised/available.

Owner/System Administrator ratings are excluded from the ordinary User Rating average.

## 10. Venue details

Open a venue to see the available details, which can include:

- type/cuisine;
- location;
- distance;
- price;
- Must Try;
- Owner notes;
- tags;
- ratings;
- venue photos;
- Website, Directions, Call, Booking or provider links where available.

## 11. Photos

Photo priority is:

1. approved Pers photo;
2. live Google Maps/Places photo;
3. TripAdvisor photo only if no suitable Google photo is available and TripAdvisor access is active;
4. placeholder.

External provider attribution is shown with provider photos.

### Add a photo

If the Owner has enabled User contributions:

1. open the venue;
2. tap **Add Photo/Add photos**;
3. choose the image;
4. provide the lightweight contributor identity requested by the app;
5. submit it.

User photos require Owner approval before they are visible to everyone.

## 12. Your rating and personal view

On a venue you can use the User rating controls and personal options such as:

- Favourite;
- Want to Visit;
- Visited;
- Private note.

Your private/personal data is separate from the Owner's Pers Rating.

## 13. My Settings

Open the top-right menu and choose **My Settings**.

You can set:

- preferred distance radius;
- language;
- whether filters should be remembered.

Supported interface languages currently include English, Español, Français, Italiano and Deutsch.

## 14. App updates

Under **My Settings → App Updates** you can see the current version and check for an updated release.

If a new version has been deployed but the old version still appears, use **Check for Update** and follow the on-screen update action. Closing and reopening the installed PWA can also help the browser activate a newly downloaded service worker.

## 15. Privacy and Terms

The footer contains:

- **Terms of Use**;
- **Privacy Policy**.

These explain the current local-storage model, location use and external-service processing.

## 16. What Users cannot change

Ordinary Users cannot:

- edit or delete venues;
- change the Pers Rating;
- change managed lists;
- approve other Users' photos;
- change collection settings;
- change API keys or external-service configuration;
- authorise service spending.

Those controls belong to the Owner/System Administrator.

## 17. If something does not work

For a missing/incorrect venue or Pers information, contact the Owner.

For connection, update or technical problems, the Owner can ask the System Administrator to check the service status and deployment.

## v0.27.24: see your selections

Below the sort control, the summary shows your active filters, selected sort and selected sources even when Filters is closed. Tap a filter's × to remove it. Clear filters removes filters and search text, while keeping your sort and source choices.

Tap Sorted by to focus the sort control. Tap Sources selected to open Filters. Tick Google Places or TripAdvisor, then tap Search selected apps. Pers stays first; external results stay in separate provider sections. A selected provider may have no results or may not be connected; read the search status shown in the summary.

Nearest now requests your device location. Allow location when prompted. Distances are straight-line distances, not walking routes. If unavailable, the summary explains the A–Z fallback. Use Update my location to retry. Venues without coordinates appear last. Missing ratings/dates/prices appear last; tied values use A–Z. Pers/User ratings and personal dates do not apply to unsaved external venues, which use A–Z for those choices.

Google photos appear when supplied by the service. If a photo cannot load, read the message and tap Retry photo. A usage-limit message means wait until the service limit resets. Uploaded photo collages still support up to four selected banner photos.


## v0.27.25 local-trial update

Photo areas now stay attached to their venues during sorting and adding places. Provider photo matching uses the saved provider ID where available and rejects ambiguous alternatives. The selections summary can be collapsed and expanded without clearing filters. Missing coordinates are excluded from the map.

This remains a local trial, with no secure email/password accounts. See [the QA audit](QA_V0.27.25.md) and [account implementation requirements](ACCOUNT_SETUP.md) for outstanding work.
