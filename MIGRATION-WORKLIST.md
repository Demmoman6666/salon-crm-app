# Multi-Tenancy Migration Worklist

The schema, OAuth install flow, billing, GDPR webhooks, onboarding, and tenant
library are DONE. What remains is the systematic pass over the app code so
every query is scoped to the current company. **The app must not ship until
every item below is checked.**

## The pattern (apply everywhere)

```ts
// TOP of every API route:
import { requireTenant, TenantError } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const t = await requireTenant();
    const rows = await prisma.customer.findMany({
      where: { companyId: t.companyId, /* ...existing filters */ },
    });
    ...
  } catch (e: any) {
    const status = e instanceof TenantError ? e.status : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
```

Rules:
- Every `findMany` / `findFirst` / `count` / `groupBy` / `aggregate` / `updateMany` / `deleteMany`: add `companyId` to `where`.
- Every `create`: add `companyId: t.companyId` to `data`.
- `findUnique` by id: switch to `findFirst({ where: { id, companyId } })` so a guessed id from another tenant returns null.
- `upsert` on a shopify id: use the new compound unique, e.g. `where: { companyId_shopifyOrderId: { companyId, shopifyOrderId } }`.
- Raw SQL (`$queryRaw`): add `AND "companyId" = ${companyId}`.

## lib/ refactors

- [ ] `lib/shopify.ts` — remove env-based `SHOPIFY_SHOP_DOMAIN` / `SHOPIFY_ADMIN_ACCESS_TOKEN`; every function takes `companyId` and uses `shopifyRest()` / `shopifyGraphql()` from `lib/shopify-app.ts`. `upsertOrderFromShopify(order, companyId)`, `pushCustomerToShopifyById(id, companyId)`, etc.
- [ ] `app/api/shopify/webhooks/route.ts` — resolve company at the top: `const company = await companyFromShopDomain(req.headers.get("x-shopify-shop-domain"))`; 200-and-skip if unknown; pass `company.id` into every upsert. Handle `app/uninstalled` → set `uninstalledAt`.
- [ ] `lib/reps.ts`, `lib/vendors.ts`, `lib/repFromTags.ts`, `lib/pipeline.ts` (pipeline is pure logic — likely no change).
- [ ] `lib/auth.ts` — login route must scope nothing (email is globally unique) but `getUserById` select can add `companyId` for convenience.

## API routes (add tenant scoping to each)

- [ ] api/admin/* (all backfills, users, unassign-inactive-reps)
- [ ] api/ai/precall, ai/pre-call-brief, ai/rep-review, ai/report
- [ ] api/brands
- [ ] api/calls, calls/coverage, calls/geo
- [ ] api/customers, customers/[id], notes, payment-terms, route-plan, visits, customers/search
- [ ] api/cycle-settings  (now per-company row: upsert by companyId)
- [ ] api/education/requests, requests/[id], api/educators, educators/[id]
- [ ] api/followups
- [ ] api/me
- [ ] api/orders, orders/[id], refund, draft
- [ ] api/par/upsert (+ par list), api/pipeline
- [ ] api/payments/stripe/*  (stamp companyId in metadata; webhook resolves it back)
- [ ] api/reports/* (brand-penetration, calls, company-overview, customer-dropoff, demand-par, gap-products, rep-scorecard, sales-by-customer, vendor-scorecard, vendor-spend)
- [ ] api/reps, reps/[id], sales-reps, salesreps/[id], scorecards/rep
- [ ] api/route-planning, api/saleshub/calls-geo
- [ ] api/search/customers, search/vendors
- [ ] api/settings/* (account, brand-visibility, visible-*-brands)
- [ ] api/shopify/backfill/* (all take companyId; trigger from onboarding "import existing data" button)
- [ ] api/shopify/collections, draft-orders, locations, orders, products, product-types, variant-prices
- [ ] api/stocked-brands, api/targets, api/users, api/vendors, api/visits
- [ ] api/webhooks/stripe

## Pages (server components that query prisma directly)

- [ ] app/customers/page.tsx, customers/[id]/page.tsx (+ actions.ts)
- [ ] app/education/requests/[id]/page.tsx
- [ ] app/orders pages, app/reps pages, app/reports pages that hit prisma directly
- [ ] app/saleshub/calendar/page.tsx

## Final checks before App Store submission

- [ ] Two test companies installed; verify zero data bleed (search, reports, webhooks).
- [ ] `app/uninstalled` webhook sets `uninstalledAt`; re-install restores access.
- [ ] Billing: trial → subscribe → callback sets plan; gate features by plan if desired.
- [ ] GDPR endpoints return 401 on bad HMAC (Shopify tests this).
- [ ] Remove `/api/dev` fallbacks, legacy email cookie auth in production.
- [ ] Privacy policy URL + support email in Partner Dashboard listing.
