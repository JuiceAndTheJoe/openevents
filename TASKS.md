# OpenEvents Task List

This document contains the detailed task breakdown for each agent. Tasks are organized by agent and priority. Each developer should pick up tasks from their assigned agent area.

## Task Status Legend

- [ ] Not started
- [x] Completed
- [~] In progress

---

## Shared Foundation (Completed)

These tasks have been completed during initial scaffolding:

- [x] Project initialization with Next.js, TypeScript, Tailwind
- [x] Prisma schema design
- [x] Database provisioning on OSC (PostgreSQL)
- [x] Storage provisioning on OSC (MinIO)
- [x] Cache provisioning on OSC (Valkey)
- [x] Core library setup (db, auth, storage, email, payments)
- [x] Validation schemas (Zod)
- [x] TypeScript types
- [x] Documentation (ARCHITECTURE.md, CONTRIBUTING.md)

---

## Auth Agent Tasks

**Owner:** Developer 1
**Focus:** User authentication, authorization, and account management

### Priority 1: Core Authentication

#### AUTH-001: Email/Password Registration API
- [ ] Create `POST /api/auth/register` endpoint
- [ ] Hash password with bcrypt
- [ ] Create user in database with ATTENDEE role
- [ ] Generate email verification token
- [ ] Send verification email
- [ ] Return appropriate success/error responses

**Files to create/modify:**
- `src/app/api/auth/register/route.ts`

#### AUTH-002: Email Verification API
- [ ] Create `GET /api/auth/verify-email` endpoint
- [ ] Validate token from query parameter
- [ ] Check token expiration (24 hours)
- [ ] Update user's `emailVerified` field
- [ ] Delete used token
- [ ] Redirect to login with success message

**Files to create/modify:**
- `src/app/api/auth/verify-email/route.ts`

#### AUTH-003: Password Reset Flow
- [ ] Create `POST /api/auth/forgot-password` endpoint
- [ ] Generate password reset token (1 hour expiry)
- [ ] Send reset email
- [ ] Create `POST /api/auth/reset-password` endpoint
- [ ] Validate token and update password
- [ ] Invalidate all existing sessions (optional)

**Files to create/modify:**
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`

### Priority 2: OAuth Integration

#### AUTH-004: Google OAuth
- [ ] Configure Google OAuth in NextAuth
- [ ] Handle auto-account creation on first login
- [ ] Link accounts if email already exists
- [ ] Test login/logout flow

**Files to modify:**
- `src/lib/auth/config.ts` (already configured, needs testing)

#### AUTH-005: GitHub OAuth
- [ ] Configure GitHub OAuth in NextAuth
- [ ] Handle auto-account creation
- [ ] Test login/logout flow

**Files to modify:**
- `src/lib/auth/config.ts` (already configured, needs testing)

### Priority 3: Auth UI Pages

#### AUTH-006: Login Page
- [ ] Create login form component
- [ ] Email/password fields with validation
- [ ] OAuth buttons (Google, GitHub)
- [ ] "Forgot password" link
- [ ] "Register" link
- [ ] Error message display
- [ ] Loading states

**Files to create:**
- `src/app/(auth)/login/page.tsx`
- `src/components/auth/LoginForm.tsx`

#### AUTH-007: Registration Page
- [ ] Create registration form component
- [ ] All required fields with validation
- [ ] Password strength indicator
- [ ] Terms acceptance checkbox
- [ ] Success message with email verification instructions

**Files to create:**
- `src/app/(auth)/register/page.tsx`
- `src/components/auth/RegisterForm.tsx`

#### AUTH-008: Email Verification Page
- [ ] Create verification pending page
- [ ] Create verification success page
- [ ] Resend verification email button

**Files to create:**
- `src/app/(auth)/verify-email/page.tsx`

#### AUTH-009: Password Reset Pages
- [ ] Create forgot password page (email input)
- [ ] Create reset password page (new password form)
- [ ] Success/error messaging

**Files to create:**
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`

### Priority 4: Role Management

#### AUTH-010: Organizer Request API
- [ ] Create `POST /api/users/request-organizer` endpoint
- [ ] Store request with org name and description
- [ ] Create `GET /api/admin/organizer-requests` endpoint (Admin only)
- [ ] Create `POST /api/admin/organizer-requests/[id]/approve` endpoint
- [ ] Create `POST /api/admin/organizer-requests/[id]/reject` endpoint
- [ ] Send notification email on approval/rejection

**Files to create:**
- `src/app/api/users/request-organizer/route.ts`
- `src/app/api/admin/organizer-requests/route.ts`
- `src/app/api/admin/organizer-requests/[id]/route.ts`

#### AUTH-011: User Profile API
- [ ] Create `GET /api/users/me` endpoint
- [ ] Create `PATCH /api/users/me` endpoint
- [ ] Create `POST /api/users/me/change-password` endpoint
- [ ] Handle profile image upload

**Files to create:**
- `src/app/api/users/me/route.ts`
- `src/app/api/users/me/change-password/route.ts`

---

## Events Agent Tasks

**Owner:** Developer 2
**Focus:** Event creation, management, and public browsing

### Priority 1: Event CRUD APIs

#### EVT-001: Create Event API
- [ ] Create `POST /api/events` endpoint (Organizer only)
- [ ] Generate unique slug from title
- [ ] Validate all fields with Zod
- [ ] Set initial status as DRAFT
- [ ] Return created event

**Files to create:**
- `src/app/api/events/route.ts`

#### EVT-002: Update Event API
- [ ] Create `PATCH /api/events/[id]` endpoint
- [ ] Verify ownership (organizer's event only)
- [ ] Validate fields
- [ ] Prevent updates to cancelled/completed events

**Files to create:**
- `src/app/api/events/[id]/route.ts`

#### EVT-003: Publish/Cancel Event API
- [ ] Create `POST /api/events/[id]/publish` endpoint
- [ ] Validate event has required fields before publishing
- [ ] Create `POST /api/events/[id]/cancel` endpoint
- [ ] Notify ticket holders on cancellation (queue email job)

**Files to create:**
- `src/app/api/events/[id]/publish/route.ts`
- `src/app/api/events/[id]/cancel/route.ts`

#### EVT-004: List Events API (Public)
- [ ] Create `GET /api/events` endpoint
- [ ] Filter by: category, date range, location, search query
- [ ] Pagination support
- [ ] Return only PUBLIC + PUBLISHED events

**Files to modify:**
- `src/app/api/events/route.ts`

#### EVT-005: Get Event Details API (Public)
- [ ] Create `GET /api/events/[slug]` endpoint
- [ ] Include: organizer, agenda, speakers, ticket types
- [ ] Check visibility (private = only with direct link)

**Files to create:**
- `src/app/api/events/[slug]/route.ts`

### Priority 2: Event Media & Content

#### EVT-006: Media Upload API
- [ ] Create `POST /api/upload/presigned` endpoint
- [ ] Generate presigned URL for MinIO
- [ ] Support image and video types
- [ ] Validate file type and size limits
- [ ] Create `POST /api/events/[id]/media` to save media reference

**Files to create:**
- `src/app/api/upload/presigned/route.ts`
- `src/app/api/events/[id]/media/route.ts`

#### EVT-007: Agenda Management API
- [ ] Create `POST /api/events/[id]/agenda` endpoint
- [ ] Create `PATCH /api/events/[id]/agenda/[itemId]` endpoint
- [ ] Create `DELETE /api/events/[id]/agenda/[itemId]` endpoint
- [ ] Support reordering

**Files to create:**
- `src/app/api/events/[id]/agenda/route.ts`
- `src/app/api/events/[id]/agenda/[itemId]/route.ts`

#### EVT-008: Speakers Management API
- [ ] Create `POST /api/events/[id]/speakers` endpoint
- [ ] Create `PATCH /api/events/[id]/speakers/[speakerId]` endpoint
- [ ] Create `DELETE /api/events/[id]/speakers/[speakerId]` endpoint
- [ ] Handle speaker photo upload

**Files to create:**
- `src/app/api/events/[id]/speakers/route.ts`
- `src/app/api/events/[id]/speakers/[speakerId]/route.ts`

### Priority 3: Public Event UI

#### EVT-009: Event Listing Page
- [ ] Create event listing page
- [ ] Search bar with filters (category, date, location)
- [ ] Event cards with image, title, date, location, price range
- [ ] Pagination
- [ ] Loading and empty states

**Files to create:**
- `src/app/(public)/events/page.tsx`
- `src/components/events/EventCard.tsx`
- `src/components/events/EventFilters.tsx`
- `src/components/events/EventList.tsx`

#### EVT-010: Event Details Page
- [ ] Create event details page
- [ ] Hero with cover image
- [ ] Event info (date, time, location with map)
- [ ] Description (rich text rendering)
- [ ] Agenda timeline
- [ ] Speakers section
- [ ] Ticket selection and purchase CTA
- [ ] Share buttons

**Files to create:**
- `src/app/(public)/events/[slug]/page.tsx`
- `src/components/events/EventHero.tsx`
- `src/components/events/EventInfo.tsx`
- `src/components/events/EventAgenda.tsx`
- `src/components/events/EventSpeakers.tsx`
- `src/components/events/LocationMap.tsx`

### Priority 4: Organizer Event Management UI

#### EVT-011: Event Creation Form
- [ ] Multi-step form or single page with sections
- [ ] Title, description (rich text editor)
- [ ] Date/time pickers with timezone
- [ ] Location type toggle (physical/online/hybrid)
- [ ] Address input with autocomplete
- [ ] Cover image upload
- [ ] Save as draft / Publish buttons

**Files to create:**
- `src/app/(dashboard)/dashboard/events/new/page.tsx`
- `src/components/events/EventForm.tsx`

#### EVT-012: Event Edit Page
- [ ] Load existing event data
- [ ] Same form as creation
- [ ] Publish/Unpublish toggle
- [ ] Cancel event button with confirmation

**Files to create:**
- `src/app/(dashboard)/dashboard/events/[id]/edit/page.tsx`

#### EVT-013: Agenda & Speakers Editor
- [ ] Inline agenda item editor
- [ ] Drag-and-drop reordering
- [ ] Speaker management panel
- [ ] Link speakers to agenda items

**Files to create:**
- `src/components/events/AgendaEditor.tsx`
- `src/components/events/SpeakerEditor.tsx`

---

## Tickets Agent Tasks

**Owner:** Developer 3
**Focus:** Ticket types, discount codes, and order processing

### Priority 1: Ticket Type APIs

#### TKT-001: Create Ticket Type API
- [ ] Create `POST /api/events/[id]/ticket-types` endpoint
- [ ] Validate with Zod schema
- [ ] Only event organizer can create

**Files to create:**
- `src/app/api/events/[id]/ticket-types/route.ts`

#### TKT-002: Update/Delete Ticket Type API
- [ ] Create `PATCH /api/events/[id]/ticket-types/[typeId]` endpoint
- [ ] Create `DELETE /api/events/[id]/ticket-types/[typeId]` endpoint
- [ ] Prevent deletion if tickets sold

**Files to create:**
- `src/app/api/events/[id]/ticket-types/[typeId]/route.ts`

#### TKT-003: Get Available Tickets API
- [ ] Create `GET /api/events/[id]/ticket-types` endpoint
- [ ] Return availability info (sold, remaining)
- [ ] Filter hidden tickets (unless discount code reveals)

**Files to create:**
- `src/app/api/events/[id]/ticket-types/route.ts` (GET method)

### Priority 2: Discount Code APIs

#### TKT-004: Create Discount Code API
- [ ] Create `POST /api/events/[id]/discount-codes` endpoint
- [ ] Validate code format and uniqueness
- [ ] Link to specific ticket types or all

**Files to create:**
- `src/app/api/events/[id]/discount-codes/route.ts`

#### TKT-005: Validate Discount Code API
- [ ] Create `POST /api/discount-codes/validate` endpoint
- [ ] Check: code exists, is active, not expired, usage limit
- [ ] Return discount details and applicable tickets

**Files to create:**
- `src/app/api/discount-codes/validate/route.ts`

#### TKT-006: Discount Code Management API
- [ ] Create `GET /api/events/[id]/discount-codes` endpoint
- [ ] Create `PATCH /api/events/[id]/discount-codes/[codeId]` endpoint
- [ ] Create `DELETE /api/events/[id]/discount-codes/[codeId]` endpoint

**Files to create:**
- `src/app/api/events/[id]/discount-codes/[codeId]/route.ts`

### Priority 3: Order Processing

#### TKT-007: Create Order API
- [ ] Create `POST /api/orders` endpoint
- [ ] Validate buyer info
- [ ] Check ticket availability (prevent overselling!)
- [ ] Calculate totals with discount
- [ ] Handle free tickets (no payment needed)
- [ ] Handle invoice codes (pending invoice status)
- [ ] Reserve tickets during checkout
- [ ] Generate order number

**Files to create:**
- `src/app/api/orders/route.ts`

#### TKT-008: Process Payment API (Stub)
- [ ] Create `POST /api/orders/[id]/pay` endpoint
- [ ] Call payment service (stub)
- [ ] Update order status on success
- [ ] Generate tickets
- [ ] Send confirmation email
- [ ] Release reservation if payment fails

**Files to create:**
- `src/app/api/orders/[id]/pay/route.ts`

#### TKT-009: Cancel Order API
- [ ] Create `POST /api/orders/[id]/cancel` endpoint
- [ ] Check cancellation deadline
- [ ] Update order and ticket statuses
- [ ] Restore ticket capacity
- [ ] Flag for refund if paid

**Files to create:**
- `src/app/api/orders/[id]/cancel/route.ts`

#### TKT-010: Refund Order API (Organizer)
- [ ] Create `POST /api/orders/[id]/refund` endpoint
- [ ] Mark refund as pending
- [ ] Record refund reason and notes
- [ ] Send notification to buyer

**Files to create:**
- `src/app/api/orders/[id]/refund/route.ts`

### Priority 4: Order & Ticket UI

#### TKT-011: Ticket Selection Component
- [ ] Display available ticket types
- [ ] Quantity selectors with min/max limits
- [ ] Price display and running total
- [ ] Discount code input
- [ ] Sold out / unavailable states

**Files to create:**
- `src/components/tickets/TicketSelector.tsx`
- `src/components/tickets/DiscountCodeInput.tsx`

#### TKT-012: Checkout Page
- [ ] Buyer information form
- [ ] Order summary
- [ ] Payment method selection
- [ ] PayPal button (stub)
- [ ] Invoice option (if discount code)
- [ ] Processing states

**Files to create:**
- `src/app/(public)/events/[slug]/checkout/page.tsx`
- `src/components/tickets/CheckoutForm.tsx`
- `src/components/tickets/OrderSummary.tsx`

#### TKT-013: Order Confirmation Page
- [ ] Order details display
- [ ] Ticket codes / QR codes
- [ ] Download tickets as PDF (stretch)
- [ ] Add to calendar links

**Files to create:**
- `src/app/(public)/orders/[orderNumber]/confirmation/page.tsx`
- `src/components/tickets/TicketDisplay.tsx`

#### TKT-014: User Orders Page
- [ ] List user's orders
- [ ] Order details view
- [ ] Cancel order button (if within deadline)
- [ ] View tickets

**Files to create:**
- `src/app/(dashboard)/dashboard/orders/page.tsx`
- `src/components/dashboard/OrderList.tsx`
- `src/components/dashboard/OrderDetails.tsx`

---

## Org Admin Panel Agent Tasks

**Owner:** Developer 4
**Focus:** Organizer dashboard, statistics, and event management UI

### Priority 1: Dashboard Overview

#### ORG-001: Dashboard Home Page
- [ ] Welcome message with organizer name
- [ ] Quick stats cards (total events, tickets sold, revenue)
- [ ] Upcoming events list
- [ ] Recent orders
- [ ] Quick action buttons

**Files to create:**
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/components/dashboard/DashboardStats.tsx`
- `src/components/dashboard/UpcomingEvents.tsx`
- `src/components/dashboard/RecentOrders.tsx`

#### ORG-002: Statistics API
- [ ] Create `GET /api/events/[id]/statistics` endpoint
- [ ] Return: tickets by type, revenue, order counts
- [ ] Create `GET /api/dashboard/statistics` endpoint
- [ ] Return: aggregate stats across all organizer events

**Files to create:**
- `src/app/api/events/[id]/statistics/route.ts`
- `src/app/api/dashboard/statistics/route.ts`

### Priority 2: Event Management List

#### ORG-003: Events List Page
- [ ] List all organizer's events
- [ ] Filter by status (draft, published, completed, cancelled)
- [ ] Search by title
- [ ] Quick actions (edit, view, publish, cancel)
- [ ] Create new event button

**Files to create:**
- `src/app/(dashboard)/dashboard/events/page.tsx`
- `src/components/dashboard/EventsTable.tsx`
- `src/components/dashboard/EventStatusBadge.tsx`

#### ORG-004: Event Detail Dashboard
- [ ] Event overview with key stats
- [ ] Ticket sales breakdown
- [ ] Revenue chart
- [ ] Recent orders for this event
- [ ] Edit event button
- [ ] Manage tickets button

**Files to create:**
- `src/app/(dashboard)/dashboard/events/[id]/page.tsx`
- `src/components/dashboard/EventDashboard.tsx`
- `src/components/dashboard/SalesChart.tsx`

### Priority 3: Ticket & Discount Management UI

#### ORG-005: Ticket Types Management Page
- [ ] List ticket types for event
- [ ] Create new ticket type form
- [ ] Edit ticket type inline or modal
- [ ] Delete with confirmation
- [ ] Capacity and sales display

**Files to create:**
- `src/app/(dashboard)/dashboard/events/[id]/tickets/page.tsx`
- `src/components/dashboard/TicketTypeList.tsx`
- `src/components/dashboard/TicketTypeForm.tsx`

#### ORG-006: Discount Codes Management Page
- [ ] List discount codes for event
- [ ] Create new discount code form
- [ ] Edit discount code
- [ ] Deactivate/delete codes
- [ ] Usage statistics

**Files to create:**
- `src/app/(dashboard)/dashboard/events/[id]/discounts/page.tsx`
- `src/components/dashboard/DiscountCodeList.tsx`
- `src/components/dashboard/DiscountCodeForm.tsx`

### Priority 4: Order Management

#### ORG-007: Event Orders List
- [ ] List all orders for an event
- [ ] Filter by status, payment method, date
- [ ] Search by buyer name/email
- [ ] Export to CSV
- [ ] Bulk actions

**Files to create:**
- `src/app/(dashboard)/dashboard/events/[id]/orders/page.tsx`
- `src/components/dashboard/OrdersTable.tsx`
- `src/components/dashboard/OrderFilters.tsx`

#### ORG-008: Order Detail View
- [ ] Full order details
- [ ] Buyer information
- [ ] Ticket list
- [ ] Payment information
- [ ] Refund button (if applicable)
- [ ] Send email to buyer

**Files to create:**
- `src/app/(dashboard)/dashboard/events/[id]/orders/[orderId]/page.tsx`
- `src/components/dashboard/OrderDetailView.tsx`

### Priority 5: Settings & Profile

#### ORG-009: Organizer Profile Settings
- [ ] Edit organization name
- [ ] Update logo
- [ ] Website and social links
- [ ] Description

**Files to create:**
- `src/app/(dashboard)/dashboard/settings/page.tsx`
- `src/components/dashboard/OrganizerProfileForm.tsx`

#### ORG-010: Account Settings
- [ ] Change password
- [ ] Update email
- [ ] Connected accounts (OAuth)
- [ ] Delete account (with confirmation)

**Files to create:**
- `src/app/(dashboard)/dashboard/settings/account/page.tsx`
- `src/components/dashboard/AccountSettings.tsx`

---

## Super Admin Tasks (Shared/Future)

These tasks can be picked up by any developer after core features are complete:

### ADM-001: Admin Dashboard
- [ ] Platform-wide statistics
- [ ] User management list
- [ ] Event moderation
- [ ] Organizer request queue

### ADM-002: User Management
- [ ] List all users
- [ ] Search/filter
- [ ] View user details
- [ ] Manage roles
- [ ] Suspend/ban users

### ADM-003: Platform Settings
- [ ] Default currency configuration
- [ ] Email templates
- [ ] Feature flags

---

## Shared Components (Any Agent)

These components can be created by any developer as needed:

### UI Components
- [ ] Button component
- [ ] Input component
- [ ] Select component
- [ ] Modal/Dialog component
- [ ] Toast notifications
- [ ] Loading spinners
- [ ] Empty states
- [ ] Error boundaries

### Layout Components
- [ ] Main navigation header
- [ ] Footer
- [ ] Dashboard sidebar
- [ ] Mobile navigation
- [ ] Breadcrumbs

---

## Notes for Developers

1. **Start with your agent's Priority 1 tasks** - These are the foundation
2. **Check ARCHITECTURE.md** for system design context
3. **Use existing validation schemas** in `src/lib/validations/`
4. **Follow TypeScript types** in `src/types/`
5. **Test your API endpoints** with curl or Postman before building UI
6. **Coordinate on shared components** to avoid duplication
7. **Update this file** when you complete or start a task

## Quick Reference

| Agent | Primary Focus | Key Prefix |
|-------|--------------|------------|
| Auth | Authentication & Users | AUTH- |
| Events | Event CRUD & Public Pages | EVT- |
| Tickets | Tickets, Discounts, Orders | TKT- |
| Org Admin | Dashboard & Management UI | ORG- |
