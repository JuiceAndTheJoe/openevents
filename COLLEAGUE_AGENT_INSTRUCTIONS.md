# Agent Instructions for Colleague

You are already working on **#56** and **#66**. Continue with the related issues below that touch the same files to avoid merge conflicts with other developers.

---

## Your Assigned Issues (in order)

### Already Started
- **#56** - Remove email input from checkout (account already has email)
- **#66** - Refund does not decrement soldCount or cancel tickets

### Next Up (Same Files)

| Issue | Title | File(s) |
|-------|-------|---------|
| **#68** | PayPal webhook matches refunds by status instead of capture ID | `src/app/api/webhooks/paypal/route.ts`, `src/app/api/orders/[id]/refund/route.ts` |
| **#59** | Abandoned orders leak reservedCount — no TTL or cleanup | `src/app/api/orders/route.ts`, `prisma/schema.prisma` |
| **#72** | No reservation TTL — checkout has no time limit | `src/app/(public)/events/[slug]/checkout/page.tsx`, `src/components/tickets/CheckoutForm.tsx` |
| **#78** | Free tickets incorrectly go through PayPal | `src/app/api/orders/route.ts`, `src/components/tickets/CheckoutForm.tsx` |

---

## Recommended Order

```
#66 (current) → #68 (same refund logic) → #59 (order creation + schema) → #72 (checkout timer) → #78 (free ticket bypass)
```

---

## Branch Strategy

Work on a single branch for all related issues:
```bash
git checkout -b fix/orders-payments-batch
```

When committing, reference issues:
```bash
git commit -m "fix: decrement soldCount on refund

Fixes #66"
```

---

## Key Files You Own

These files are assigned to you — no one else should edit them today:

- `src/app/api/orders/route.ts`
- `src/app/api/orders/[id]/refund/route.ts`
- `src/app/api/webhooks/paypal/route.ts`
- `src/components/tickets/CheckoutForm.tsx`
- `src/app/(public)/events/[slug]/checkout/page.tsx`
- `prisma/schema.prisma` (coordinate if adding fields)

---

## Quick Reference for Each Issue

### #68 - Fix refund webhook matching
```typescript
// WRONG (current):
const order = await prisma.order.findFirst({
  where: { refundStatus: 'PENDING' }
});

// CORRECT:
const captureId = event.resource?.id;
const order = await prisma.order.findFirst({
  where: { paypalCaptureId: captureId }
});
```

### #59 - Add expiresAt to orders
1. Add to schema: `expiresAt DateTime?`
2. Set on order creation: `expiresAt: new Date(Date.now() + 15 * 60 * 1000)`
3. Create cleanup route or cron job

### #72 - Add checkout timer
- Read `expiresAt` from order
- Display countdown in `CheckoutForm.tsx`
- Redirect when expired

### #78 - Skip PayPal for $0 orders
```typescript
if (orderTotal === 0) {
  // Create order with status PAID directly
  // Create tickets immediately
  // Skip PayPal entirely
}
```

---

## When Done

1. Run `npm run lint`
2. Create PR with title: `fix: orders/payments batch (#56, #66, #68, #59, #72, #78)`
3. Request review before merging

---

## Agent Prompts

```
# Start with #68 since it relates to #66
Fix issue #68 - PayPal webhook should match refunds by capture ID, not status field. See handleCaptureRefunded in src/app/api/webhooks/paypal/route.ts

# Then #59
Fix issue #59 - Add expiresAt field to Order model and set 15-min TTL on order creation. Add cleanup logic for expired PENDING orders

# Then #72
Fix issue #72 - Add countdown timer to checkout page using the order's expiresAt field

# Then #78
Fix issue #78 - When order total is $0, skip PayPal and create tickets directly with PAID status
```

---

Delete this file when done.
