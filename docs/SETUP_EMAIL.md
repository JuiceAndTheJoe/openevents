# Setting Up Email for OpenEvents

OpenEvents sends transactional emails for:
- Email verification (new user registration)
- Password reset
- Order confirmations
- Event cancellation notifications

## Email Modes

### Development Mode (Default)

In development mode, emails are **logged to the console** instead of being sent. This is useful for:
- Local development without SMTP configuration
- Testing email templates and content
- Debugging email-related flows

**Configuration:**
```env
EMAIL_MODE=development
```

**Example console output:**
```
============================================================
📧 EMAIL (Development Mode - Not Actually Sent)
============================================================
To:      user@example.com
From:    OpenEvents <noreply@openevents.local>
Subject: Verify your OpenEvents account
------------------------------------------------------------
🔗 Links in email:
   http://localhost:3000/verify-email?token=abc123...
============================================================
```

### Production Mode (SMTP)

For production, you must configure an external SMTP provider.

**Configuration:**
```env
EMAIL_MODE=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-api-key
EMAIL_FROM=noreply@yourdomain.com
```

## Recommended SMTP Providers

### SendGrid

1. Create account at https://sendgrid.com
2. Create an API key with "Mail Send" permissions
3. Configure:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=SG.your-api-key-here
   ```

### Postmark

1. Create account at https://postmarkapp.com
2. Get your Server API Token
3. Configure:
   ```env
   SMTP_HOST=smtp.postmarkapp.com
   SMTP_PORT=587
   SMTP_USER=your-server-api-token
   SMTP_PASSWORD=your-server-api-token
   ```

### Mailgun

1. Create account at https://mailgun.com
2. Get your SMTP credentials from the dashboard
3. Configure:
   ```env
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_USER=postmaster@your-domain.mailgun.org
   SMTP_PASSWORD=your-mailgun-password
   ```

### Amazon SES

1. Set up Amazon SES in your AWS account
2. Verify your sending domain
3. Create SMTP credentials in the SES console
4. Configure:
   ```env
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USER=your-ses-smtp-user
   SMTP_PASSWORD=your-ses-smtp-password
   ```

## Why No Built-in Email on OSC?

Eyevinn Open Source Cloud (OSC) does not provide a built-in transactional email service. This is because:

1. **Email deliverability** requires proper domain verification, SPF/DKIM records, and reputation management
2. **Spam prevention** requires dedicated infrastructure and monitoring
3. **Specialized providers** (SendGrid, Postmark, etc.) handle this better and more reliably

## Testing Email Configuration

### Check if email is configured:

```typescript
import { isEmailConfigured, getEmailMode } from '@/lib/email'

console.log('Email mode:', getEmailMode())
console.log('Is configured:', isEmailConfigured())
```

### Send a test email:

```typescript
import { sendEmail } from '@/lib/email'

await sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<p>This is a test email from OpenEvents</p>',
  text: 'This is a test email from OpenEvents',
})
```

## Email Templates

OpenEvents includes pre-built email templates for:

| Function | Purpose |
|----------|---------|
| `sendVerificationEmail(email, token)` | Email verification link |
| `sendPasswordResetEmail(email, token)` | Password reset link |
| `sendOrderConfirmationEmail(email, orderDetails)` | Order confirmation |
| `sendEventCancellationEmail(email, details)` | Event cancellation notice |

All templates are HTML emails with plain-text fallbacks.

## Customizing Email Templates

Email templates are located in `src/lib/email/index.ts`. To customize:

1. Find the template function (e.g., `sendVerificationEmail`)
2. Modify the HTML content
3. Update the plain-text fallback

Example customization:
```typescript
export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`

  await sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}!`,
    html: `
      <!-- Your custom HTML template -->
      <div style="...">
        <h1>Welcome!</h1>
        <a href="${verifyUrl}">Verify Email</a>
      </div>
    `,
    text: `Verify your email: ${verifyUrl}`,
  })
}
```

## Troubleshooting

### Emails not sending in production

1. Check `EMAIL_MODE` is set to `smtp`
2. Verify SMTP credentials are correct
3. Check SMTP provider dashboard for errors
4. Look for error logs in the application

### Emails going to spam

1. Set up SPF record for your domain
2. Configure DKIM signing with your provider
3. Use a verified "from" email address
4. Avoid spam trigger words in subject/content

### Connection timeout

1. Check firewall allows outbound port 587
2. Verify SMTP host is correct
3. Try port 465 with `SMTP_SECURE=true`
