# Pers Favourites v027c - Cloudflare backend

Production architecture: Cloudflare Pages + Pages Functions, D1 for structured data, R2 for venue photos, and Cloudflare Access for protected Owner/Admin and contributor routes. Ordinary browsing remains public.

## Required bindings

- `PERS_DB` -> D1 database
- `PERS_PHOTOS` -> R2 bucket

## Required variables

- `DEPLOYMENT_ID` - must exactly match `deploymentId` in the production `config.js`
- `OWNER_EMAIL` - Owner email address
- `CF_ACCESS_TEAM_DOMAIN` - for example `https://your-team.cloudflareaccess.com`
- `CF_ACCESS_ADMIN_AUD` - Access Application Audience (AUD) for the `/api/admin*` application
- `CF_ACCESS_CONTRIB_AUD` - Access Application Audience (AUD) for the `/api/contribute*` application
- `OPENAI_MODEL` - optional; default `gpt-5.6-luna`

## Optional secret

- `OPENAI_API_KEY` - required only when the Owner enables **Ask Pers** in Settings. Store it as a Cloudflare secret; never put it in `config.js` or browser code.

## Access paths

Create separate Cloudflare Access applications/policies for:

- `/api/admin*` - allow only Owner/Admin identities.
- `/api/contribute*` - allow people who may contribute venue photos. The app still limits contributors to their own contributions.

Leave these public:

- `/api/public*` - public read-only catalogue data, place lookup and optional Ask Pers endpoint.
- `/media/*` - approved venue photos only.

The Functions verify the Access JWT as an additional server-side control. Because the Admin and Contributor Access applications can have different audience tags, v027c has separate `CF_ACCESS_ADMIN_AUD` and `CF_ACCESS_CONTRIB_AUD` variables.

## Database

Run `cloudflare/schema.sql` against the D1 database before first production use. The Owner profile is created automatically on first authenticated Owner request when `OWNER_EMAIL` matches the Access identity. Additional Admins can be inserted into the `profiles` table with role `admin`.

## Deployment

For a Pages project that uses Functions, deploy from the connected Git repository or with Wrangler. Configure the D1 and R2 bindings and variables for the Production environment, then redeploy.

## Ask Pers privacy/cost design

Ask Pers is OFF by default. When enabled, only the user's natural-language question is sent to the OpenAI API. The model returns a strict structured filter/query plan; Pers applies that plan to the venue data already loaded in the browser. The model is not given the Pers venue database and is never allowed to submit SQL.
