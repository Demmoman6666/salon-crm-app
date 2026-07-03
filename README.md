# Salon CRM — Shopify App Store build

Multi-tenant CRM for professional hair & beauty distributors, installable from
the Shopify App Store. Forked from the proven SBP-CRM single-tenant build.

**Removed from this build:** Purchase Ordering (all Linnworks integration) and Marketing.

## What's already built

- **Multi-tenant schema** — `Company` model; every tenant model carries `companyId` with compound uniques (`prisma/schema.prisma`)
- **Shopify OAuth install flow** — `/api/shopify/auth` → `/api/shopify/auth/callback` (HMAC + state verified, offline token stored per company, webhooks auto-registered)
- **Billing** — Shopify Billing API subscriptions (`lib/shopify-app.ts` PLANS: Starter $49 / Growth $99 / Pro $199, 14-day trial) via `/api/billing/subscribe`
- **GDPR webhooks** — `/api/shopify/gdpr` (customers/data_request, customers/redact, shop/redact) — mandatory for App Store approval
- **Onboarding wizard** — `/onboarding` (company → admin account → brands → reps), creates the ADMIN user and logs them in
- **Tenant library** — `lib/tenant.ts` (`requireTenant()` used by every API route)
- **Per-company Shopify API access** — `shopifyRest()` / `shopifyGraphql()` in `lib/shopify-app.ts`

## What remains

See **MIGRATION-WORKLIST.md** — the systematic route-by-route pass adding
`companyId` scoping to every query. Do not launch before completing it.

## Setup

1. **Shopify Partner Dashboard** → Create app → copy API key/secret
   - App URL: `https://<your-domain>`
   - Redirect URL: `https://<your-domain>/api/shopify/auth/callback`
   - GDPR webhooks: point all three at `/api/shopify/gdpr`
2. **Neon** → create Postgres DB, copy `DATABASE_URL`
3. Copy `.env.example` → configure env vars in Vercel
4. `npm install && npx prisma db push`
5. Deploy to Vercel
6. Install on a dev store: visit `https://<your-domain>/api/shopify/auth?shop=your-dev-store.myshopify.com`

## Local dev

```bash
npm install
npx prisma db push
npm run dev
```
