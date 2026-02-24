import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail, sendEventCancellationEmail } from '@/lib/email'
import { formatDateTime } from '@/lib/utils'

const ACCOUNT_DELETION_CONFIRM_TOKEN_PREFIX = 'account-delete-confirm:'
const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url))
}

function getTokenFromQuery(request: NextRequest): string | null {
  const token = new URL(request.url).searchParams.get('token')
  return token && token.trim() ? token.trim() : null
}

async function getTokenFromPostBody(request: NextRequest): Promise<string | null> {
  const formData = await request.formData().catch(() => null)
  const token = formData?.get('token')
  return typeof token === 'string' && token.trim() ? token.trim() : null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderConfirmationPage(request: NextRequest, token: string) {
  const postUrl = new URL(request.url)
  postUrl.searchParams.set('token', token)
  const accountSettingsUrl = new URL('/dashboard/settings/account', request.url).toString()

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirm account deletion</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
        padding: 24px;
      }
      .card {
        max-width: 560px;
        margin: 40px auto;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      }
      h1 { margin: 0 0 12px; font-size: 1.4rem; }
      p { margin: 0 0 12px; line-height: 1.5; }
      .warn { color: #991b1b; }
      .actions {
        margin-top: 18px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      button, a {
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        text-decoration: none;
        padding: 10px 14px;
      }
      button {
        border: 1px solid #b91c1c;
        background: #dc2626;
        color: #fff;
        cursor: pointer;
      }
      a {
        border: 1px solid #cbd5e1;
        color: #0f172a;
        background: #fff;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Confirm account deletion</h1>
      <p class="warn">
        This action will anonymize your account, cancel your active published future events, and cancel associated active orders.
      </p>
      <p>Click the button below to confirm deletion now.</p>
      <form method="POST" action="${escapeHtml(postUrl.toString())}">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <div class="actions">
          <button type="submit">Confirm deletion</button>
          <a href="${escapeHtml(accountSettingsUrl)}">Cancel</a>
        </div>
      </form>
    </main>
  </body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

async function confirmDeletionByToken(token: string, request: NextRequest) {
  const now = new Date()
  const verificationToken = await prisma.userVerificationToken.findUnique({
    where: {
      token: `${ACCOUNT_DELETION_CONFIRM_TOKEN_PREFIX}${token}`,
    },
    select: {
      id: true,
      userId: true,
      expires: true,
      user: {
        select: {
          id: true,
          email: true,
          deletedAt: true,
          organizerProfile: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  if (!verificationToken) {
    return redirectTo('/login?error=invalid_delete_token', request)
  }

  if (verificationToken.expires <= now) {
    await prisma.userVerificationToken.delete({
      where: { id: verificationToken.id },
    })
    return redirectTo('/login?error=delete_token_expired', request)
  }

  if (!verificationToken.user || verificationToken.user.deletedAt) {
    await prisma.userVerificationToken.deleteMany({
      where: { id: verificationToken.id },
    })
    return redirectTo('/login?message=account_deleted', request)
  }

  const deletionEffectiveAt = new Date(
    now.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  )
  const anonymizedEmail = `deleted+${verificationToken.userId}-${now.getTime()}@openevents.invalid`

  const activeEvents = verificationToken.user.organizerProfile
    ? await prisma.event.findMany({
        where: {
          organizerId: verificationToken.user.organizerProfile.id,
          status: 'PUBLISHED',
          startDate: {
            gt: now,
          },
        },
        select: {
          id: true,
          title: true,
          startDate: true,
          orders: {
            where: {
              status: {
                in: ['PAID', 'PENDING', 'PENDING_INVOICE'],
              },
            },
            select: {
              buyerEmail: true,
              buyerFirstName: true,
              buyerLastName: true,
              orderNumber: true,
            },
          },
        },
      })
    : []

  const activeEventIds = activeEvents.map((event) => event.id)
  const attendeeNotifications = activeEvents.flatMap((event) =>
    event.orders.map((order) => ({
      eventTitle: event.title,
      eventDate: event.startDate,
      order,
    }))
  )

  await prisma.$transaction(async (tx) => {
    if (activeEventIds.length > 0) {
      await tx.event.updateMany({
        where: {
          id: {
            in: activeEventIds,
          },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        },
      })

      await tx.order.updateMany({
        where: {
          eventId: {
            in: activeEventIds,
          },
          status: {
            in: ['PENDING', 'PENDING_INVOICE'],
          },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          expiresAt: null,
        },
      })

      await tx.order.updateMany({
        where: {
          eventId: {
            in: activeEventIds,
          },
          status: 'PAID',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          expiresAt: null,
          refundStatus: 'PENDING',
          refundReason: 'Organizer account deleted',
        },
      })
    }

    await tx.session.deleteMany({
      where: { userId: verificationToken.userId },
    })

    await tx.account.deleteMany({
      where: { userId: verificationToken.userId },
    })

    await tx.userVerificationToken.deleteMany({
      where: { userId: verificationToken.userId },
    })

    await tx.passwordResetToken.deleteMany({
      where: { userId: verificationToken.userId },
    })

    await tx.userRole.deleteMany({
      where: { userId: verificationToken.userId },
    })

    await tx.user.update({
      where: { id: verificationToken.userId },
      data: {
        email: anonymizedEmail,
        firstName: null,
        lastName: null,
        passwordHash: null,
        emailVerified: null,
        deletedAt: deletionEffectiveAt,
        anonymizedAt: now,
      },
    })
  })

  if (attendeeNotifications.length > 0) {
    await Promise.allSettled(
      attendeeNotifications.map(({ eventTitle, eventDate, order }) =>
        sendEventCancellationEmail(order.buyerEmail, {
          eventTitle,
          eventDate: formatDateTime(eventDate),
          buyerName: `${order.buyerFirstName} ${order.buyerLastName}`.trim() || 'Attendee',
          orderNumber: order.orderNumber,
        })
      )
    )
  }

  await sendEmail({
    to: verificationToken.user.email,
    subject: 'Your OpenEvents account deletion has been confirmed',
    html: `
        <p>Your account deletion request has been confirmed and completed.</p>
        <p>Your personal account data has been anonymized.</p>
        <p>The account record will remain in retention until <strong>${formatDateTime(deletionEffectiveAt)}</strong>.</p>
      `,
    text: `Your account deletion request has been confirmed and completed. Personal data has been anonymized. The account record will remain in retention until ${formatDateTime(deletionEffectiveAt)}.`,
  }).catch((error) => {
    console.error('Failed to send account deletion confirmation email:', error)
  })

  return redirectTo('/login?message=account_deleted', request)
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromQuery(request)
    if (!token) {
      return redirectTo('/login?error=missing_delete_token', request)
    }

    const verificationToken = await prisma.userVerificationToken.findUnique({
      where: {
        token: `${ACCOUNT_DELETION_CONFIRM_TOKEN_PREFIX}${token}`,
      },
      select: {
        expires: true,
        user: {
          select: {
            deletedAt: true,
          },
        },
      },
    })

    if (!verificationToken) {
      return redirectTo('/login?error=invalid_delete_token', request)
    }

    if (verificationToken.expires <= new Date()) {
      return redirectTo('/login?error=delete_token_expired', request)
    }

    if (verificationToken.user?.deletedAt) {
      return redirectTo('/login?message=account_deleted', request)
    }

    return renderConfirmationPage(request, token)
  } catch (error) {
    console.error('Failed to render account deletion confirmation page:', error)
    return redirectTo('/login?error=account_delete_failed', request)
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromQuery(request) ?? (await getTokenFromPostBody(request))
    if (!token) {
      return redirectTo('/login?error=missing_delete_token', request)
    }

    return confirmDeletionByToken(token, request)
  } catch (error) {
    console.error('Failed to confirm account deletion:', error)
    return redirectTo('/login?error=account_delete_failed', request)
  }
}
