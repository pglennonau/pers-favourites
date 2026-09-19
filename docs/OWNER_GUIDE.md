# Pers Favourites — Owner Guide

Version: **0.27.23 development**

This guide covers the controls intended for the collection Owner. Technical deployment and API-secret management are documented in the System Administrator Guide.

## Owner responsibilities

The Owner controls the Pers collection: venue content, Pers ratings, archive/delete decisions, managed lists, user-photo moderation, collection name and presentation, and whether optional paid services are authorised.

## Costs & Payments

v0.27.23 adds an Owner-facing **Costs & Payments** area. It is intended to show each external service separately rather than hiding charges inside technical settings.

Services currently represented:

- Google Places / Google Maps
- TripAdvisor
- Cloudflare
- OpenAI / Ask Pers
- future paid services as they are added

Where a provider makes the information available, the Owner view should show connection status, plan/mode, usage, free allowance, estimated charges, reset/renewal date, paid-usage authorisation, spending cap and masked payment details.

Pers must never store a full payment-card number or security code. Actual payment methods remain with the provider.

## TripAdvisor cost safeguard

TripAdvisor API use is optional. The Cloudflare Worker is the authoritative usage counter.

The intended rules are:

- warning at 50% of the configured free allowance;
- automatic API pause at 95% unless paid usage is explicitly authorised;
- the free allowance and allowance period are configurable rather than hard-coded;
- paid use must not start silently;
- the zero-cost **View on TripAdvisor** link remains available even when API access is paused.

The Owner can record approval for paid TripAdvisor API use in Pers. For safety, that approval alone does not turn on paid calls. The System Administrator must mirror that approval into the protected Cloudflare Owner-approval flag and separately enable paid use. Both server-side gates must be true before the Worker can pass the free cutoff.

## External search presentation

Search results are kept visually separate:

1. Pers Favourites
2. More places from Google
3. TripAdvisor results

Google and TripAdvisor ratings are never blended into a single Pers rating.

Google Maps content is treated as live provider information. The app may show Google-supplied details while the Owner is selecting a place, but unchanged Google-supplied details are not permanently copied into the Pers catalogue. Pers retains the permitted Google Place ID and the Owner's own existing or edited Pers fields. This also prevents Google Places coordinates from being reused on the app's OpenStreetMap/Leaflet map.

## Venue photo priority

When a venue card/detail has no approved Pers photo, v0.27.23 uses this order:

1. approved Pers photo;
2. live Google Maps/Places photo;
3. live TripAdvisor photo only if Google has no usable photo and TripAdvisor API access is enabled;
4. Pers placeholder.

TripAdvisor photo fallback can consume API calls, so it remains subject to the TripAdvisor quota safeguard. Google photo resource names are used live and are not stored in Pers. Google photo/source attribution and a source-photo link are displayed when supplied by Google.

## Owner payment approval

Before approving paid usage, check the provider's current plan, free allowance, expected usage and spending limit. The System Administrator should confirm that the provider's billing and API terms still match the values shown in Pers.

## Terms and privacy

v0.27.23 includes publicly accessible **Terms of Use** and **Privacy Policy** links in the app. These pages describe current local storage, location use, Cloudflare service routing and external provider handling. They are support pages inside the code package, not additional Owner manuals.

## Documentation discipline

Each release updates this Owner Guide, the System Administrator Guide and the User Guide. The System Administrator Guide contains the documentation change log for the release.
