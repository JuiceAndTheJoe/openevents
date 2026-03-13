import nodemailer from 'nodemailer'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

// =============================================================================
// Email Configuration
// =============================================================================
//
// OSC does not provide a built-in SMTP service. Options:
//
// 1. DEVELOPMENT MODE (EMAIL_MODE=development):
//    - Emails are logged to console instead of being sent
//    - No SMTP configuration needed
//    - Useful for local development and testing
//
// 2. PRODUCTION MODE:
//    - Configure an external SMTP provider:
//      - SendGrid: smtp.sendgrid.net
//      - Postmark: smtp.postmarkapp.com
//      - Mailgun: smtp.mailgun.org
//      - Amazon SES: email-smtp.<region>.amazonaws.com
//    - Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
//
// =============================================================================

const EMAIL_MODE = process.env.EMAIL_MODE || (process.env.NODE_ENV === 'development' ? 'development' : 'smtp')
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@openevents.local'
const APP_NAME = process.env.APP_NAME || 'OpenEvents'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Create transporter based on mode
function createTransporter() {
  if (EMAIL_MODE === 'development') {
    // Development mode: use a "fake" transport that logs to console
    return {
      sendMail: async (mailOptions: nodemailer.SendMailOptions) => {
        console.log('\n' + '='.repeat(60))
        console.log('📧 EMAIL (Development Mode - Not Actually Sent)')
        console.log('='.repeat(60))
        console.log(`To:      ${mailOptions.to}`)
        console.log(`From:    ${mailOptions.from}`)
        console.log(`Subject: ${mailOptions.subject}`)
        console.log('-'.repeat(60))
        console.log('Text Content:')
        console.log(mailOptions.text || '(no text content)')
        console.log('-'.repeat(60))

        // Extract any URLs from the HTML for easy clicking in dev
        const htmlContent = mailOptions.html as string
        const urlMatch = htmlContent?.match(/href="([^"]+)"/g)
        if (urlMatch) {
          console.log('🔗 Links in email:')
          urlMatch.forEach(match => {
            const url = match.replace('href="', '').replace('"', '')
            if (url.startsWith('http')) {
              console.log(`   ${url}`)
            }
          })
        }
        console.log('='.repeat(60) + '\n')

        return { messageId: `dev-${Date.now()}` }
      }
    }
  }

  // Production mode: use real SMTP
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

const transporter = createTransporter()

interface Attachment {
  filename: string
  content: Buffer
  contentType: string
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Attachment[]
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    })

    if (EMAIL_MODE !== 'development') {
      console.log(`Email sent to ${options.to}: ${options.subject}`)
    }
  } catch (error) {
    console.error('Failed to send email:', error)

    // In development, don't throw - just log
    if (EMAIL_MODE === 'development') {
      console.warn('Email sending failed in development mode - this is expected if no SMTP is configured')
      return
    }

    throw new Error('Failed to send email')
  }
}

/**
 * Check if email service is properly configured
 */
export function isEmailConfigured(): boolean {
  if (EMAIL_MODE === 'development') {
    return true // Development mode always "works"
  }
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

/**
 * Get current email mode
 */
export function getEmailMode(): string {
  return EMAIL_MODE
}

// ============================================================================
// Email Templates
// ============================================================================

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`

  await sendEmail({
    to: email,
    subject: `Verify your ${APP_NAME} account`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify your email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Welcome to ${APP_NAME}!</h1>
            <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Verify Email Address
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              If you didn't create an account on ${APP_NAME}, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Welcome to ${APP_NAME}! Please verify your email by visiting: ${verifyUrl}`,
  })
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  await sendEmail({
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset your password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Reset Your Password</h1>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Reset your ${APP_NAME} password by visiting: ${resetUrl}`,
  })
}

async function generateOrderPdf(orderDetails: {
  orderNumber: string
  eventTitle: string
  eventDate: string
  eventLocation: string
  tickets: Array<{ name: string; quantity: number; price: string }>
  totalAmount: string
  buyerName: string
  vatRate?: number | null
  vatAmount?: string | null
  ticketCodes?: string[]
}): Promise<Buffer> {
  // Pre-generate QR buffers before starting the PDF (async)
  const qrBuffers: Buffer[] = []
  if (orderDetails.ticketCodes && orderDetails.ticketCodes.length > 0) {
    for (const code of orderDetails.ticketCodes) {
      const buf = await QRCode.toBuffer(code, { type: 'png', width: 150, margin: 1 })
      qrBuffers.push(buf)
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text('Order Confirmation', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(12).font('Helvetica').text(`Order #${orderDetails.orderNumber}`, { align: 'center' })
    doc.moveDown(1.5)

    // Event details
    doc.fontSize(14).font('Helvetica-Bold').text('Event Details')
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.4)
    doc.fontSize(11).font('Helvetica')
    doc.text(`Event:     ${orderDetails.eventTitle}`)
    doc.text(`Date:      ${orderDetails.eventDate}`)
    doc.text(`Location:  ${orderDetails.eventLocation}`)
    doc.moveDown(1.2)

    // Buyer details
    doc.fontSize(14).font('Helvetica-Bold').text('Buyer')
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.4)
    doc.fontSize(11).font('Helvetica').text(orderDetails.buyerName)
    doc.moveDown(1.2)

    // Tickets table header
    doc.fontSize(14).font('Helvetica-Bold').text('Tickets')
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.4)

    const colTicket = 50
    const colQty = 360
    const colPrice = 440

    doc.fontSize(11).font('Helvetica-Bold')
    doc.text('Ticket', colTicket, doc.y, { continued: false })
    const headerY = doc.y - doc.currentLineHeight()
    doc.text('Qty', colQty, headerY, { continued: false })
    doc.text('Price', colPrice, headerY, { continued: false })
    doc.moveDown(0.3)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.3)

    doc.font('Helvetica').fontSize(11)
    for (const ticket of orderDetails.tickets) {
      const rowY = doc.y
      doc.text(ticket.name, colTicket, rowY, { width: 290 })
      const lineHeight = doc.y - rowY
      doc.text(String(ticket.quantity), colQty, rowY)
      doc.text(ticket.price, colPrice, rowY)
      doc.y = rowY + lineHeight
      doc.moveDown(0.2)
    }

    doc.moveDown(0.5)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.4)

    // VAT row
    if (orderDetails.vatRate && orderDetails.vatRate > 0) {
      const vatPercent = Math.round(orderDetails.vatRate * 100)
      doc.fontSize(11).font('Helvetica')
      doc.text(`VAT (${vatPercent}%): ${orderDetails.vatAmount ?? '0.00'}`, { align: 'right' })
      doc.moveDown(0.3)
    }

    // Total
    doc.fontSize(12).font('Helvetica-Bold')
    doc.text(`Total: ${orderDetails.totalAmount}`, { align: 'right' })

    // QR codes section
    if (qrBuffers.length > 0 && orderDetails.ticketCodes) {
      doc.moveDown(1.5)
      doc.fontSize(14).font('Helvetica-Bold').text('Your Tickets')
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown(0.6)

      for (let i = 0; i < qrBuffers.length; i++) {
        const code = orderDetails.ticketCodes[i]
        const ticketY = doc.y
        doc.image(qrBuffers[i], 50, ticketY, { width: 80, height: 80 })
        doc.fontSize(11).font('Helvetica-Bold').text(`Ticket ${i + 1}`, 150, ticketY)
        doc.fontSize(9).font('Helvetica').text(code, 150, ticketY + 16, { width: 370 })
        doc.y = ticketY + 90
        doc.moveDown(0.3)
      }
    }

    doc.end()
  })
}

export async function sendOrderConfirmationEmail(
  email: string,
  orderDetails: {
    orderNumber: string
    eventTitle: string
    eventDate: string
    eventLocation: string
    tickets: Array<{ name: string; quantity: number; price: string }>
    totalAmount: string
    buyerName: string
    vatRate?: number | null
    vatAmount?: string | null
    ticketCodes?: string[]
  }
): Promise<void> {
  const ticketRows = orderDetails.tickets
    .map(
      (t) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${t.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${t.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${t.price}</td>
        </tr>
      `
    )
    .join('')

  const pdfBuffer = await generateOrderPdf(orderDetails)

  await sendEmail({
    to: email,
    subject: `Order Confirmation #${orderDetails.orderNumber} - ${orderDetails.eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Order Confirmed!</h1>
            <p>Hi ${orderDetails.buyerName},</p>
            <p>Thank you for your order. Here are your order details:</p>

            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #1e40af;">${orderDetails.eventTitle}</h2>
              <p><strong>Date:</strong> ${orderDetails.eventDate}</p>
              <p><strong>Location:</strong> ${orderDetails.eventLocation}</p>
              <p><strong>Order Number:</strong> #${orderDetails.orderNumber}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f1f5f9;">
                  <th style="padding: 10px; text-align: left;">Ticket</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${ticketRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding: 10px; text-align: right;"><strong>Total:</strong></td>
                  <td style="padding: 10px; text-align: right;"><strong>${orderDetails.totalAmount}</strong></td>
                </tr>
              </tfoot>
            </table>

            <p>Your order confirmation is attached as a PDF.</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              Questions about your order? Contact the event organizer or reply to this email.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Order Confirmed! Order #${orderDetails.orderNumber} for ${orderDetails.eventTitle}. Total: ${orderDetails.totalAmount}. Your order confirmation is attached as a PDF.`,
    attachments: [
      {
        filename: `order-${orderDetails.orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

export async function sendEventCancellationEmail(
  email: string,
  details: {
    eventTitle: string
    eventDate: string
    buyerName: string
    orderNumber: string
  }
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Event Cancelled: ${details.eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Event Cancelled</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626;">Event Cancelled</h1>
            <p>Hi ${details.buyerName},</p>
            <p>We're sorry to inform you that the following event has been cancelled:</p>

            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #991b1b;">${details.eventTitle}</h2>
              <p><strong>Original Date:</strong> ${details.eventDate}</p>
              <p><strong>Order Number:</strong> #${details.orderNumber}</p>
            </div>

            <p>The event organizer will be in touch regarding refunds if applicable.</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              If you have any questions, please contact the event organizer.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Event Cancelled: ${details.eventTitle} scheduled for ${details.eventDate} has been cancelled. Order #${details.orderNumber}.`,
  })
}

export async function sendRefundConfirmationEmail(
  email: string,
  details: {
    buyerName: string
    orderNumber: string
    eventTitle: string
    refundAmount: string
    currency: string
    refundReason?: string
  }
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Refund Processed - Order #${details.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Refund Processed</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #059669;">Refund Processed</h1>
            <p>Hi ${details.buyerName},</p>
            <p>Your refund has been processed successfully.</p>

            <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
              <h2 style="margin-top: 0; color: #047857;">${details.eventTitle}</h2>
              <p><strong>Order Number:</strong> #${details.orderNumber}</p>
              <p><strong>Refund Amount:</strong> ${details.refundAmount} ${details.currency}</p>
              ${details.refundReason ? `<p><strong>Reason:</strong> ${details.refundReason}</p>` : ''}
            </div>

            <p>The refund should appear in your original payment method within 5-10 business days, depending on your bank or payment provider.</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              If you have any questions about this refund, please contact the event organizer.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Refund Processed: Your refund of ${details.refundAmount} ${details.currency} for order #${details.orderNumber} (${details.eventTitle}) has been processed.`,
  })
}

export async function sendOrderCancellationEmail(
  email: string,
  details: {
    buyerName: string
    orderNumber: string
    eventTitle: string
    eventDate: string
    cancellationReason?: string
  }
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Order Cancelled - #${details.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order Cancelled</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626;">Order Cancelled</h1>
            <p>Hi ${details.buyerName},</p>
            <p>Your order has been cancelled.</p>

            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #991b1b;">${details.eventTitle}</h2>
              <p><strong>Order Number:</strong> #${details.orderNumber}</p>
              <p><strong>Event Date:</strong> ${details.eventDate}</p>
              ${details.cancellationReason ? `<p><strong>Reason:</strong> ${details.cancellationReason}</p>` : ''}
            </div>

            <p>If you did not request this cancellation or have any questions, please contact the event organizer.</p>

            <p style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/events" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Browse More Events
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This email confirms the cancellation of your order.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Order Cancelled: Your order #${details.orderNumber} for ${details.eventTitle} on ${details.eventDate} has been cancelled.`,
  })
}

export async function sendAccountDeletionConfirmationEmail(
  email: string,
  details: {
    confirmUrl: string
    expiresAt: Date
  }
): Promise<void> {
  const expiryLabel = details.expiresAt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  await sendEmail({
    to: email,
    subject: `Confirm account deletion for ${APP_NAME}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Confirm account deletion</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626;">Confirm account deletion</h1>
            <p>We received a request to delete your ${APP_NAME} account.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${details.confirmUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Confirm account deletion
              </a>
            </p>
            <p>If you do nothing, your account will remain active.</p>
            <p>This confirmation link expires on <strong>${expiryLabel}</strong>.</p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${details.confirmUrl}</p>
          </div>
        </body>
      </html>
    `,
    text: `Confirm your ${APP_NAME} account deletion: ${details.confirmUrl}. This link expires on ${expiryLabel}.`,
  })
}

export async function sendAccountDeletionScheduledEmail(
  email: string,
  details: {
    scheduledFor: Date
    gracePeriodDays: number
    cancelUrl: string
  }
): Promise<void> {
  const scheduledForLabel = details.scheduledFor.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  await sendEmail({
    to: email,
    subject: `${APP_NAME} account deletion scheduled`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Account deletion scheduled</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #dc2626;">Account deletion scheduled</h1>
            <p>Your ${APP_NAME} account is now scheduled for deletion.</p>
            <p><strong>Deletion date:</strong> ${scheduledForLabel}</p>
            <p>You can cancel this request at any time during the ${details.gracePeriodDays}-day grace period.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${details.cancelUrl}" style="background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Cancel account deletion
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${details.cancelUrl}</p>
          </div>
        </body>
      </html>
    `,
    text: `Your ${APP_NAME} account deletion is scheduled for ${scheduledForLabel}. Cancel request: ${details.cancelUrl}`,
  })
}

export async function sendAccountDeletionCancelledEmail(email: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: `${APP_NAME} account deletion canceled`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Account deletion canceled</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #0f766e;">Account deletion canceled</h1>
            <p>Your ${APP_NAME} account deletion request has been canceled.</p>
            <p>You can keep using your account as usual.</p>
          </div>
        </body>
      </html>
    `,
    text: `Your ${APP_NAME} account deletion request has been canceled.`,
  })
}

export async function sendInvoiceOrderNotificationEmail(
  organizerEmail: string,
  details: {
    orderNumber: string
    eventTitle: string
    eventId: string
    buyerName: string
    buyerEmail: string
    totalAmount: string
    currency: string
    tickets: Array<{ name: string; quantity: number; price: string }>
    vatRate?: number | null
    vatAmount?: string | null
  }
): Promise<void> {
  const ticketRows = details.tickets
    .map(
      (t) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${t.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${t.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${t.price}</td>
        </tr>
      `
    )
    .join('')

  const dashboardUrl = `${APP_URL}/dashboard/events/${details.eventId}/orders`

  await sendEmail({
    to: organizerEmail,
    subject: `New Invoice Order #${details.orderNumber} - ${details.eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Invoice Order</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #d97706;">New Invoice Order Received</h1>
            <p>A new invoice order has been placed for your event and requires payment confirmation.</p>

            <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706;">
              <h2 style="margin-top: 0; color: #92400e;">${details.eventTitle}</h2>
              <p><strong>Order Number:</strong> #${details.orderNumber}</p>
              <p><strong>Buyer:</strong> ${details.buyerName}</p>
              <p><strong>Email:</strong> ${details.buyerEmail}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f1f5f9;">
                  <th style="padding: 8px; text-align: left;">Ticket</th>
                  <th style="padding: 8px; text-align: center;">Qty</th>
                  <th style="padding: 8px; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${ticketRows}
              </tbody>
              <tfoot>
                ${details.vatRate && details.vatRate > 0 ? `
                <tr>
                  <td colspan="2" style="padding: 8px; text-align: right;">VAT (${Math.round(details.vatRate * 100)}%):</td>
                  <td style="padding: 8px; text-align: right;">${details.vatAmount ?? '0.00'} ${details.currency}</td>
                </tr>
                ` : ''}
                <tr>
                  <td colspan="2" style="padding: 8px; text-align: right;"><strong>Total:</strong></td>
                  <td style="padding: 8px; text-align: right;"><strong>${details.totalAmount} ${details.currency}</strong></td>
                </tr>
              </tfoot>
            </table>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e;">
                <strong>Action Required:</strong> Once you receive payment, mark this order as paid in your dashboard to issue the tickets to the buyer.
              </p>
            </div>

            <p style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="background-color: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Orders Dashboard
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated notification from ${APP_NAME}.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `New Invoice Order #${details.orderNumber} for ${details.eventTitle}. Buyer: ${details.buyerName} (${details.buyerEmail}). Total: ${details.totalAmount} ${details.currency}. View orders: ${dashboardUrl}`,
  })
}
