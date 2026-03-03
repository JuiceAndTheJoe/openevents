/**
 * Cleanup Attendee-Only User Accounts
 *
 * This script identifies and removes user accounts that were created solely for
 * ticket purchasing (attendee-only accounts). These accounts are no longer needed
 * after removing the authentication requirement for ticket purchases.
 *
 * Usage:
 *   npx ts-node scripts/cleanup-attendee-accounts.ts           # Dry run (no changes)
 *   npx ts-node scripts/cleanup-attendee-accounts.ts --execute # Actually delete
 *
 * Safety features:
 * - Runs in dry-run mode by default
 * - Uses transactions for data integrity
 * - Processes in batches to avoid timeouts
 * - Preserves orders (unlinks user but keeps order data)
 * - Never deletes users with pending orders
 * - Never deletes organizers or admins
 */

import { PrismaClient, Role, OrderStatus } from '@prisma/client'

const prisma = new PrismaClient()

const BATCH_SIZE = 100
const DRY_RUN = !process.argv.includes('--execute')

interface CleanupStats {
  totalUsersFound: number
  usersWithPendingOrders: number
  usersDeleted: number
  accountsDeleted: number
  sessionsDeleted: number
  rolesDeleted: number
  verificationTokensDeleted: number
  passwordResetTokensDeleted: number
  ordersUnlinked: number
}

/**
 * Find all users who ONLY have the ATTENDEE role
 */
async function findAttendeeOnlyUsers(): Promise<string[]> {
  console.log('\n🔍 Finding attendee-only users...\n')

  // Get all users who have at least one role
  const usersWithRoles = await prisma.user.findMany({
    where: {
      deletedAt: null, // Only active users
      anonymizedAt: null, // Not anonymized
    },
    include: {
      roles: true,
      organizerProfile: true,
      orders: {
        where: {
          status: OrderStatus.PENDING,
        },
        select: {
          id: true,
          status: true,
        },
      },
    },
  })

  const attendeeOnlyUserIds: string[] = []

  for (const user of usersWithRoles) {
    // Skip if user has no roles at all
    if (user.roles.length === 0) {
      continue
    }

    // Check if user ONLY has ATTENDEE role
    const hasOnlyAttendeeRole =
      user.roles.length === 1 && user.roles[0].role === Role.ATTENDEE

    // Skip if user has other roles
    if (!hasOnlyAttendeeRole) {
      continue
    }

    // Skip if user has an organizer profile
    if (user.organizerProfile) {
      console.log(
        `  ⚠️  Skipping ${user.email} - has organizer profile despite only having ATTENDEE role`
      )
      continue
    }

    // Skip if user has pending orders
    if (user.orders.length > 0) {
      console.log(
        `  ⚠️  Skipping ${user.email} - has ${user.orders.length} pending order(s)`
      )
      continue
    }

    attendeeOnlyUserIds.push(user.id)
  }

  return attendeeOnlyUserIds
}

/**
 * Get statistics for a batch of users before deletion
 */
async function getUserStats(userIds: string[]): Promise<{
  accounts: number
  sessions: number
  roles: number
  verificationTokens: number
  passwordResetTokens: number
  completedOrders: number
}> {
  const [accounts, sessions, roles, verificationTokens, passwordResetTokens, completedOrders] =
    await Promise.all([
      prisma.account.count({ where: { userId: { in: userIds } } }),
      prisma.session.count({ where: { userId: { in: userIds } } }),
      prisma.userRole.count({ where: { userId: { in: userIds } } }),
      prisma.userVerificationToken.count({ where: { userId: { in: userIds } } }),
      prisma.passwordResetToken.count({ where: { userId: { in: userIds } } }),
      prisma.order.count({
        where: {
          userId: { in: userIds },
          status: { notIn: [OrderStatus.PENDING] },
        },
      }),
    ])

  return {
    accounts,
    sessions,
    roles,
    verificationTokens,
    passwordResetTokens,
    completedOrders,
  }
}

/**
 * Delete a batch of attendee-only users and their related data
 */
async function deleteUserBatch(userIds: string[]): Promise<CleanupStats> {
  const stats: CleanupStats = {
    totalUsersFound: userIds.length,
    usersWithPendingOrders: 0,
    usersDeleted: 0,
    accountsDeleted: 0,
    sessionsDeleted: 0,
    rolesDeleted: 0,
    verificationTokensDeleted: 0,
    passwordResetTokensDeleted: 0,
    ordersUnlinked: 0,
  }

  if (userIds.length === 0) {
    return stats
  }

  // Get stats before deletion
  const beforeStats = await getUserStats(userIds)

  if (DRY_RUN) {
    // In dry-run mode, just report what would be deleted
    stats.usersDeleted = userIds.length
    stats.accountsDeleted = beforeStats.accounts
    stats.sessionsDeleted = beforeStats.sessions
    stats.rolesDeleted = beforeStats.roles
    stats.verificationTokensDeleted = beforeStats.verificationTokens
    stats.passwordResetTokensDeleted = beforeStats.passwordResetTokens
    stats.ordersUnlinked = beforeStats.completedOrders

    return stats
  }

  // Execute deletion in a transaction
  await prisma.$transaction(async (tx) => {
    // 1. Unlink orders from users (set userId to null)
    const ordersUpdate = await tx.order.updateMany({
      where: {
        userId: { in: userIds },
        status: { notIn: [OrderStatus.PENDING] },
      },
      data: {
        userId: null,
      },
    })
    stats.ordersUnlinked = ordersUpdate.count

    // 2. Delete accounts (cascade via Prisma)
    const accountsDelete = await tx.account.deleteMany({
      where: { userId: { in: userIds } },
    })
    stats.accountsDeleted = accountsDelete.count

    // 3. Delete sessions (cascade via Prisma)
    const sessionsDelete = await tx.session.deleteMany({
      where: { userId: { in: userIds } },
    })
    stats.sessionsDeleted = sessionsDelete.count

    // 4. Delete user roles
    const rolesDelete = await tx.userRole.deleteMany({
      where: { userId: { in: userIds } },
    })
    stats.rolesDeleted = rolesDelete.count

    // 5. Delete verification tokens
    const verificationTokensDelete = await tx.userVerificationToken.deleteMany({
      where: { userId: { in: userIds } },
    })
    stats.verificationTokensDeleted = verificationTokensDelete.count

    // 6. Delete password reset tokens
    const passwordResetTokensDelete = await tx.passwordResetToken.deleteMany({
      where: { userId: { in: userIds } },
    })
    stats.passwordResetTokensDeleted = passwordResetTokensDelete.count

    // 7. Finally, delete the users
    const usersDelete = await tx.user.deleteMany({
      where: { id: { in: userIds } },
    })
    stats.usersDeleted = usersDelete.count
  })

  return stats
}

/**
 * Main execution function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║        Attendee-Only User Accounts Cleanup Script             ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n')
    console.log('   To actually delete accounts, run with --execute flag\n')
  } else {
    console.log('\n🚨 EXECUTE MODE - Changes will be permanent!\n')
  }

  // Find all attendee-only users
  const attendeeOnlyUserIds = await findAttendeeOnlyUsers()

  console.log(`\n📊 Found ${attendeeOnlyUserIds.length} attendee-only user(s)\n`)

  if (attendeeOnlyUserIds.length === 0) {
    console.log('✅ No attendee-only users to clean up. Done!\n')
    return
  }

  // Get sample users for display
  const sampleUsers = await prisma.user.findMany({
    where: { id: { in: attendeeOnlyUserIds.slice(0, 5) } },
    select: {
      id: true,
      email: true,
      createdAt: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
        },
      },
    },
  })

  console.log('Sample users to be processed:')
  for (const user of sampleUsers) {
    const completedOrders = user.orders.filter((o) => o.status !== OrderStatus.PENDING)
    console.log(
      `  • ${user.email} (created ${user.createdAt.toISOString().split('T')[0]}, ${completedOrders.length} order(s))`
    )
  }

  if (attendeeOnlyUserIds.length > 5) {
    console.log(`  ... and ${attendeeOnlyUserIds.length - 5} more`)
  }

  console.log('\n')

  // Process in batches
  const totalStats: CleanupStats = {
    totalUsersFound: attendeeOnlyUserIds.length,
    usersWithPendingOrders: 0,
    usersDeleted: 0,
    accountsDeleted: 0,
    sessionsDeleted: 0,
    rolesDeleted: 0,
    verificationTokensDeleted: 0,
    passwordResetTokensDeleted: 0,
    ordersUnlinked: 0,
  }

  const batches = Math.ceil(attendeeOnlyUserIds.length / BATCH_SIZE)

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, attendeeOnlyUserIds.length)
    const batch = attendeeOnlyUserIds.slice(start, end)

    console.log(`Processing batch ${i + 1}/${batches} (${batch.length} users)...`)

    const batchStats = await deleteUserBatch(batch)

    // Aggregate stats
    totalStats.usersDeleted += batchStats.usersDeleted
    totalStats.accountsDeleted += batchStats.accountsDeleted
    totalStats.sessionsDeleted += batchStats.sessionsDeleted
    totalStats.rolesDeleted += batchStats.rolesDeleted
    totalStats.verificationTokensDeleted += batchStats.verificationTokensDeleted
    totalStats.passwordResetTokensDeleted += batchStats.passwordResetTokensDeleted
    totalStats.ordersUnlinked += batchStats.ordersUnlinked

    if (!DRY_RUN) {
      console.log(`  ✓ Batch ${i + 1} completed`)
    }
  }

  // Print final summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗')
  console.log('║                      CLEANUP SUMMARY                           ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  if (DRY_RUN) {
    console.log('📋 The following changes WOULD be made:\n')
  } else {
    console.log('✅ The following changes were made:\n')
  }

  console.log(`   Users ${DRY_RUN ? 'to be deleted' : 'deleted'}:             ${totalStats.usersDeleted}`)
  console.log(`   Accounts ${DRY_RUN ? 'to be deleted' : 'deleted'}:          ${totalStats.accountsDeleted}`)
  console.log(`   Sessions ${DRY_RUN ? 'to be deleted' : 'deleted'}:          ${totalStats.sessionsDeleted}`)
  console.log(`   User roles ${DRY_RUN ? 'to be deleted' : 'deleted'}:        ${totalStats.rolesDeleted}`)
  console.log(`   Verification tokens ${DRY_RUN ? 'to be deleted' : 'deleted'}: ${totalStats.verificationTokensDeleted}`)
  console.log(`   Password reset tokens ${DRY_RUN ? 'to be deleted' : 'deleted'}: ${totalStats.passwordResetTokensDeleted}`)
  console.log(`   Orders ${DRY_RUN ? 'to be unlinked' : 'unlinked'}:        ${totalStats.ordersUnlinked}`)

  console.log('\n📌 Note: Orders remain in the database (userId set to null)\n')

  if (DRY_RUN) {
    console.log('To execute these changes, run:')
    console.log('  npx ts-node scripts/cleanup-attendee-accounts.ts --execute\n')
  } else {
    console.log('✅ Cleanup completed successfully!\n')
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('\n❌ Error during cleanup:')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
