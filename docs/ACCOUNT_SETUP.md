# Administrator, Owner and Temporary Owner setup

Status: implementation specification, not an enabled account system. Updated for the v0.27.25 local-trial release on 20 September 2026.

## Current limitation

The app runs in local mode. `signIn`, `sendMagicLink`, `sendRecovery`, `updatePassword`, production data loading and shared photo storage are explicitly unimplemented in `app.js`. The Worker handles external services, not Pers accounts or the shared catalogue. Switching the test role does not authenticate anyone. Changing an email in local storage would not create a secure account.

The Administrator padlock is the expected result of opening Settings as the local Owner. My Settings → Local trial identity → Test role can select the Administrator for testing. This does not secure the collection and must not be presented as password setup.

## Account model to implement

| Identity | Login | Intended access | Handover |
| --- | --- | --- | --- |
| Administrator | Verified email and its own password | System settings and external service configuration | Retains technical access; no automatic Owner role |
| Owner | Verified email and its own password | Owner pane and collection management | Permanent ownership |
| Temporary Owner | Separate verified identity from the permanent Owner | Owner pane and collection management during setup | Owner can revoke the temporary grant without changing the Owner password |

If the Administrator is also the Temporary Owner, one verified identity can hold both grants. Revoking its temporary grant must leave only Administrator permissions. Both owners must work on the same collection; they must not share a password or inherit device-specific test identities.

Confirmed setup decisions: Pat holds Administrator and Temporary Owner permissions on one identity; Per holds permanent Owner permission. Per controls when Pat's Temporary Owner permission ends, with no automatic role expiry. Normal login-session expiry still applies. Account addresses have been supplied privately and must be verified during provisioning, not published in this repository.

Per initially uses Pat's address for recovery. Implement a separate Owner-controlled Recovery email field requiring re-authentication and verification before a new address takes effect; this must not change Per's login address. Removing Pat's Temporary Owner permission does not remove the recovery route. At handover, Per must switch to his own verified recovery address before confidential information is added, and outstanding recovery links must be invalidated. See Open Actions OA-03, OA-15 and OA-16 in the Administrator manual.

Confidential Owner information must remain unavailable until permanent ownership is established and temporary access has been removed. Revocation cannot retract information that someone already downloaded. Administrator technical access also must not silently grant access to Owner-only fields through an API, backup or export.

## Required backend and product work

1. Provision the authentication service, verified email sender, approved frontend origin and setup/recovery return URLs. Keep credentials in server secrets. Do not store passwords or password hashes in the PWA or repository.
2. Implement email verification, password sign-in, password change, recovery, sign-out, expiry and session revocation. Use generic recovery responses, rate limits, single-use expiring recovery links and reauthentication for sensitive changes. See [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) and [password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
3. Create an authoritative collection membership store. Server checks must derive identity and role from the verified session, never browser-supplied role fields. The temporary grant has no automatic expiry: Per initiates its removal, and the server must enforce the revoked state.
4. Implement shared catalogue and photo storage with permissions on every read/write, moderation and export operation. Separate public venue information from Owner-private information. Prevent the service worker and public catalogue response from retaining confidential content.
5. Migrate local venues, notes and photos only after making and validating a complete backup. Preserve immutable venue/photo IDs, reject ambiguous references and report missing blobs. Trial roles must not be imported as trusted production grants. Test restart, another device and concurrent edits.
6. Replace the test selector with real account status, sign-in and sign-out. Both owners enter the same Owner area. Show temporary-access status and the permanent Owner's revoke control. Prevent removing the last permanent Owner.
7. Add an audit trail for invitations, role changes, sign-ins, recovery, revocation and destructive actions. Do not log credentials or recovery tokens. Define the recovery path if the sole Owner loses access.

## Acceptance tests before activation

| Test | Required result |
| --- | --- |
| Administrator, Owner and Temporary Owner each sign in | Correct identity and correct pane access |
| Incorrect password, unknown email, unverified email, throttling | No unauthorised session; safe error behaviour |
| Password recovery | Delivered link works once, expires, and cannot reset a different account |
| Browser role/local-storage tampering and direct API calls | Cannot elevate privileges |
| Temporary grant revoked during an active session | Next protected request denied; a refresh token cannot restore the grant |
| Administrator keeps technical access after temporary grant removal | Owner-only requests remain denied |
| Sign-out, password change and account disable | Session lifecycle follows the documented revocation policy |
| Same collection on two devices | Stable venue/photo associations and recoverable edit conflicts |
| Confidential fields, exports, caches and backups | No disclosure to public, revoked temporary or unentitled Administrator identities |
| Owner recovery and last-owner protection | Owner cannot accidentally leave the collection permanently inaccessible |

## Provisioning inputs still needed

- Verify the privately supplied Administrator/Temporary Owner and permanent Owner addresses.
- Provision and test the agreed initial recovery address and Owner-controlled change flow.
- Access to the target Cloudflare project and any existing authentication/email service, or confirmation that these services still need provisioning.

Passwords are to be entered by their owners through the secure setup flow, not sent in chat. No accounts, passwords, invitations, new paid services or Cloudflare configuration are created by this release.
