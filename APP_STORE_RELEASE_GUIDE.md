# ServiceCalc Shopify App Store Release Guide

This guide is written for first-time Shopify app publishers and is tailored to this repository.

## 1) What is already done in this repo

- App is configured as App Store distribution (`AppDistribution.AppStore`) in `app/shopify.server.js`.
- Embedded app setup is in place.
- App proxy is configured in `shopify.app.toml`.
- Build, lint, and tests pass locally.
- Required privacy webhooks are configured in `shopify.app.toml` and implemented in:
  - `app/routes/webhooks.customers.data_request.jsx`
  - `app/routes/webhooks.customers.redact.jsx`
  - `app/routes/webhooks.shop.redact.jsx`

## 2) Install and sign in tools

Run these from the project root:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use default

pnpm -v
npx @shopify/cli version
npx @shopify/cli auth login
```

## 3) Create production hosting before submission

Shopify reviewers must be able to install and use your app on a real HTTPS URL.

Minimum production requirements:

- Always-on hosting (Cloud Run, Render, Fly, etc.)
- HTTPS app URL
- Persistent production database (do not use local SQLite in production)
- Environment variables configured in host

Required env vars for this app:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SCOPES`
- `DATABASE_URL`
- `NODE_ENV=production`

## 4) Configure app in Shopify Partner Dashboard

In Partner Dashboard for this app:

1. Set **App URL** to your production URL.
2. Set **Allowed redirection URL(s)** to include your production auth callback URLs.
3. Verify embedded app is enabled.
4. Confirm requested scopes match real app behavior.

Then push config:

```bash
npx @shopify/cli app deploy
```

## 5) Complete mandatory legal and support assets

Before you can submit, create public URLs for:

- Privacy Policy
- Terms of Service
- Support URL
- Contact email

Also prepare:

- Data retention/deletion explanation
- Clear explanation of why each access scope is needed

## 6) Billing decision (must be clear before review)

Choose one:

- Free app
- One-time charge
- Recurring subscription
- Usage-based billing

If paid, implement and test Shopify billing flows before submission.

## 7) QA checklist before submission

1. Install app on a clean dev store.
2. Uninstall/reinstall to verify onboarding and webhook recovery.
3. Run full user flow:
   - Configure calculator
   - Render theme app block
   - Submit calculator form
   - Create draft order
4. Trigger and verify webhook handling.
5. Verify app works with only requested scopes.
6. Confirm there are no broken links or missing UI states.

## 8) Build App Store listing materials

Prepare these assets:

- App name and short value proposition
- Detailed description (what it does, for whom)
- Scope justification text
- Demo video
- Screenshots
- Pricing details
- Support process and response SLA

## 9) Submit for review

In Partner Dashboard:

1. Go to **Distribution** and switch to public listing workflow.
2. Fill all listing fields and policy URLs.
3. Submit for review.
4. Respond to reviewer feedback quickly; resubmit as needed.

## 10) Common reasons for rejection

- Missing or weak privacy policy / terms
- Scopes requested without clear justification
- Broken install/auth flow
- App not functional on reviewer test store
- Billing or pricing mismatch between app and listing
- Poor support contact information

## 11) Current next actions for this repo

1. Deploy this app to a production host with PostgreSQL/MySQL.
2. Set production app URL and redirects in Partner Dashboard.
3. Run `npx @shopify/cli app deploy`.
4. Create and publish legal/support URLs.
5. Complete listing content and submit.
