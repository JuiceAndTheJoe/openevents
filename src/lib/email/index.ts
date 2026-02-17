import nodemailer from 'nodemailer'

// Email transporter configuration
// In development, use MailSlurper or similar
// In production, replace with your transactional email provider
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '2500'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    : undefined,
})

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@openevents.local'
const APP_NAME = process.env.APP_NAME || 'OpenEvents'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
    throw new Error('Failed to send email')
  }
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

            <p style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/dashboard/orders" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Your Tickets
              </a>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              Questions about your order? Contact the event organizer or reply to this email.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Order Confirmed! Order #${orderDetails.orderNumber} for ${orderDetails.eventTitle}. Total: ${orderDetails.totalAmount}`,
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
