/*
 * One-off backfill: any historical order whose totalAmount is 0 should have
 * paymentMethod=FREE (not INVOICE/PAYPAL). Mirrors the principle "we never
 * invoice anyone for a free order" introduced in the order-creation routes.
 *
 * Usage:
 *   OE_TARGET=dev  npx tsx scripts/backfill-free-orders-payment-method.ts
 *   OE_TARGET=prod npx tsx scripts/backfill-free-orders-payment-method.ts
 *
 * By default runs in dry-run mode. Add OE_APPLY=1 to actually write.
 */
import { PrismaClient } from '@prisma/client'

const target = process.env.OE_TARGET ?? 'dev'
const apply = process.env.OE_APPLY === '1'

const url =
  target === 'prod'
    ? 'postgresql://openevents:OpenEvents2026!@172.232.131.169:10596/openevents'
    : 'postgresql://openevents:OpenEventsDev2026!@172.232.137.101:10533/openevents'

const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const candidates = await prisma.order.findMany({
    where: {
      totalAmount: 0,
      paymentMethod: { not: 'FREE' },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      totalAmount: true,
      buyerEmail: true,
      createdAt: true,
      discountCode: { select: { code: true, discountType: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Target: ${target}  Apply: ${apply}`)
  console.log(`Found ${candidates.length} zero-total orders not marked FREE.`)
  for (const o of candidates) {
    console.log(
      `  ${o.orderNumber}  status=${o.status}  paymentMethod=${o.paymentMethod}  ` +
        `code=${o.discountCode?.code ?? '-'}(${o.discountCode?.discountType ?? '-'})  ${o.buyerEmail}`
    )
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with OE_APPLY=1 to update paymentMethod=FREE and status=PAID.')
    return
  }

  for (const o of candidates) {
    await prisma.order.update({
      where: { id: o.id },
      data: {
        paymentMethod: 'FREE',
        status: 'PAID',
        paidAt: o.status === 'PAID' ? undefined : new Date(),
      },
    })
    console.log(`Updated ${o.orderNumber}`)
  }
}

main().finally(() => prisma.$disconnect())
