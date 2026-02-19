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
- [x] Create `POST /api/auth/register` endpoint
- [x] Hash password with bcrypt
- [x] Create user in database with ATTENDEE role
- [x] Generate email verification token
- [x] Send verification email
- [x] Return appropriate success/error responses

**Files to create/modify:**
- `src/app/api/auth/register/route.ts`

#### AUTH-002: Email Verification API
- [x] Create `GET /api/auth/verify-email` endpoint
- [x] Validate token from query parameter
- [x] Check token expiration (24 hours)
- [x] Update user's `emailVerified` field
- [x] Delete used token
- [x] Redirect to login with success message

**Files to create/modify:**
- `src/app/api/auth/verify-email/route.ts`

#### AUTH-003: Password Reset Flow
- [x] Create `POST /api/auth/forgot-password` endpoint
- [x] Generate password reset token (1 hour expiry)
- [x] Send reset email
- [x] Create `POST /api/auth/reset-password` endpoint
- [x] Validate token and update password
- [x] Invalidate all existing sessions (optional)

**Files to create/modify:**
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`

### Priority 2: OAuth Integration

#### AUTH-004: Google OAuth
- [x] Configure Google OAuth in NextAuth
- [x] Handle auto-account creation on first login
- [x] Link accounts if email already exists
- [ ] Test login/logout flow

**Files to modify:**
- `src/lib/auth/config.ts` (already configured, needs testing)

#### AUTH-005: GitHub OAuth
- [x] Configure GitHub OAuth in NextAuth
- [x] Handle auto-account creation
- [ ] Test login/logout flow

**Files to modify:**
- `src/lib/auth/config.ts` (already configured, needs testing)

### Priority 3: Auth UI Pages

#### AUTH-006: Login Page
- [x] Create login form component
- [x] Email/password fields with validation
- [x] OAuth buttons (Google, GitHub)
- [x] "Forgot password" link
- [x] "Register" link
- [x] Error message display
- [x] Loading states

**Files to create:**
- `src/app/(auth)/login/page.tsx`
- `src/components/auth/LoginForm.tsx`

#### AUTH-007: Registration Page
- [x] Create registration form component
- [x] All required fields with validation
- [x] Password strength indicator
- [x] Terms acceptance checkbox
- [x] Success message with email verification instructions

**Files to create:**
- `src/app/(auth)/register/page.tsx`
- `src/components/auth/RegisterForm.tsx`

#### AUTH-008: Email Verification Page
- [x] Create verification pending page
- [x] Create verification success page
- [x] Resend verification email button

**Files to create:**
- `src/app/(auth)/verify-email/page.tsx`

#### AUTH-009: Password Reset Pages
- [x] Create forgot password page (email input)
- [x] Create reset password page (new password form)
- [x] Success/error messaging

**Files to create:**
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`

### Priority 4: Role Management

#### AUTH-010: Organizer Request API
- [x] Create `POST /api/users/request-organizer` endpoint
- [x] Store request with org name and description
- [x] Create `GET /api/admin/organizer-requests` endpoint (Admin only)
- [x] Create `POST /api/admin/organizer-requests/[id]/approve` endpoint
- [x] Create `POST /api/admin/organizer-requests/[id]/reject` endpoint
- [ ] Send notification email on approval/rejection

**Files to create:**
- `src/app/api/users/request-organizer/route.ts`
- `src/app/api/admin/organizer-requests/route.ts`
- `src/app/api/admin/organizer-requests/[id]/route.ts`

#### AUTH-011: User Profile API
- [x] Create `GET /api/users/me` endpoint
- [x] Create `PATCH /api/users/me` endpoint
- [x] Create `POST /api/users/me/change-password` endpoint
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
- [x] Create `POST /api/events` endpoint (Organizer only)
- [x] Generate unique slug from title
- [x] Validate all fields with Zod
- [x] Set initial status as DRAFT
- [x] Return created event

**Files to create:**
- `src/app/api/events/route.ts`

#### EVT-002: Update Event API
- [x] Create `PATCH /api/events/[id]` endpoint
- [x] Verify ownership (organizer's event only)
- [x] Validate fields
- [x] Prevent updates to cancelled/completed events

**Files to create:**
- `src/app/api/events/[id]/route.ts`

#### EVT-003: Publish/Cancel Event API
- [x] Create `POST /api/events/[id]/publish` endpoint
- [x] Validate event has required fields before publishing
- [x] Create `POST /api/events/[id]/cancel` endpoint
- [x] Notify ticket holders on cancellation (queue email job)

**Files to create:**
- `src/app/api/events/[id]/publish/route.ts`
- `src/app/api/events/[id]/cancel/route.ts`

#### EVT-004: List Events API (Public)
- [x] Create `GET /api/events` endpoint
- [x] Filter by: category, date range, location, search query
- [x] Pagination support
- [x] Return only PUBLIC + PUBLISHED events

**Files to modify:**
- `src/app/api/events/route.ts`

#### EVT-005: Get Event Details API (Public)
- [~] Create `GET /api/events/[slug]` endpoint
- [x] Include: organizer, agenda, speakers, ticket types
- [x] Check visibility (private = only with direct link)

Note: Implemented currently as `GET /api/events/[id]` with slug lookup in
`src/app/api/events/[id]/route.ts` due Next.js dynamic route segment constraints.

**Files to create:**
- `src/app/api/events/[slug]/route.ts`

### Priority 2: Event Media & Content

#### EVT-006: Media Upload API
- [x] Create `POST /api/upload/presigned` endpoint
- [x] Generate presigned URL for MinIO
- [x] Support image and video types
- [x] Validate file type and size limits
- [x] Create `POST /api/events/[id]/media` to save media reference

**Files to create:**
- `src/app/api/upload/presigned/route.ts`
- `src/app/api/events/[id]/media/route.ts`

#### EVT-007: Agenda Management API
- [x] Create `POST /api/events/[id]/agenda` endpoint
- [x] Create `PATCH /api/events/[id]/agenda/[itemId]` endpoint
- [x] Create `DELETE /api/events/[id]/agenda/[itemId]` endpoint
- [x] Support reordering

**Files to create:**
- `src/app/api/events/[id]/agenda/route.ts`
- `src/app/api/events/[id]/agenda/[itemId]/route.ts`

#### EVT-008: Speakers Management API
- [x] Create `POST /api/events/[id]/speakers` endpoint
- [x] Create `PATCH /api/events/[id]/speakers/[speakerId]` endpoint
- [x] Create `DELETE /api/events/[id]/speakers/[speakerId]` endpoint
- [x] Handle speaker photo upload

**Files to create:**
- `src/app/api/events/[id]/speakers/route.ts`
- `src/app/api/events/[id]/speakers/[speakerId]/route.ts`

### Priority 3: Public Event UI

#### EVT-009: Event Listing Page
- [x] Create event listing page
- [x] Search bar with filters (category, date, location)
- [x] Event cards with image, title, date, location, price range
- [x] Pagination
- [x] Loading and empty states

**Files to create:**
- `src/app/(public)/events/page.tsx`
- `src/components/events/EventCard.tsx`
- `src/components/events/EventFilters.tsx`
- `src/components/events/EventList.tsx`

#### EVT-010: Event Details Page
- [x] Create event details page
- [x] Hero with cover image
- [x] Event info (date, time, location with map)
- [x] Description (rich text rendering)
- [x] Agenda timeline
- [x] Speakers section
- [x] Ticket selection and purchase CTA
- [x] Share buttons

**Files to create:**
- `src/app/(public)/events/[slug]/page.tsx`
- `src/components/events/EventHero.tsx`
- `src/components/events/EventInfo.tsx`
- `src/components/events/EventAgenda.tsx`
- `src/components/events/EventSpeakers.tsx`
- `src/components/events/LocationMap.tsx`

### Priority 4: Organizer Event Management UI

#### EVT-011: Event Creation Form
- [x] Multi-step form or single page with sections
- [x] Title, description (rich text editor)
- [x] Date/time pickers with timezone
- [x] Location type toggle (physical/online/hybrid)
- [x] Address input with autocomplete
- [x] Cover image upload
- [x] Save as draft / Publish buttons

**Files to create:**
- `src/app/(dashboard)/dashboard/events/new/page.tsx`
- `src/components/events/EventForm.tsx`

#### EVT-012: Event Edit Page
- [x] Load existing event data
- [x] Same form as creation
- [x] Publish/Unpublish toggle
- [x] Cancel event button with confirmation

**Files to create:**
- `src/app/(dashboard)/dashboard/events/[id]/edit/page.tsx`

#### EVT-013: Agenda & Speakers Editor
- [x] Inline agenda item editor
- [x] Drag-and-drop reordering
- [x] Speaker management panel
- [x] Link speakers to agenda items

**Files to create:**
- `src/components/events/AgendaEditor.tsx`
- `src/components/events/SpeakerEditor.tsx`

---

## Tickets Agent Tasks

**Owner:** Developer 3
**Focus:** Ticket types, discount codes, and order processing

### Priority 1: Ticket Type APIs

#### TKT-001: Create Ticket Type API
- [x] Create `POST /api/events/[id]/ticket-types` endpoint
- [x] Validate with Zod schema
- [x] Only event organizer can create

**Files to create:**
- `src/app/api/events/[id]/ticket-types/route.ts`

#### TKT-002: Update/Delete Ticket Type API
- [x] Create `PATCH /api/events/[id]/ticket-types/[typeId]` endpoint
- [x] Create `DELETE /api/events/[id]/ticket-types/[typeId]` endpoint
- [x] Prevent deletion if tickets sold

**Files to create:**
- `src/app/api/events/[id]/ticket-types/[typeId]/route.ts`

#### TKT-003: Get Available Tickets API
- [x] Create `GET /api/events/[id]/ticket-types` endpoint
- [x] Return availability info (sold, remaining)
- [x] Filter hidden tickets (unless discount code reveals)

**Files to create:**
- `src/app/api/events/[id]/ticket-types/route.ts` (GET method)

### Priority 2: Discount Code APIs

#### TKT-004: Create Discount Code API
- [x] Create `POST /api/events/[id]/discount-codes` endpoint
- [x] Validate code format and uniqueness
- [x] Link to specific ticket types or all

**Files to create:**
- `src/app/api/events/[id]/discount-codes/route.ts`

#### TKT-005: Validate Discount Code API
- [x] Create `POST /api/discount-codes/validate` endpoint
- [x] Check: code exists, is active, not expired, usage limit
- [x] Return discount details and applicable tickets

**Files to create:**
- `src/app/api/discount-codes/validate/route.ts`

#### TKT-006: Discount Code Management API
- [x] Create `GET /api/events/[id]/discount-codes` endpoint
- [x] Create `PATCH /api/events/[id]/discount-codes/[codeId]` endpoint
- [x] Create `DELETE /api/events/[id]/discount-codes/[codeId]` endpoint

**Files to create:**
- `src/app/api/events/[id]/discount-codes/[codeId]/route.ts`

### Priority 3: Order Processing

#### TKT-007: Create Order API
- [x] Create `POST /api/orders` endpoint
- [x] Validate buyer info
- [x] Check ticket availability (prevent overselling!)
- [x] Calculate totals with discount
- [x] Handle free tickets (no payment needed)
- [x] Handle invoice codes (pending invoice status)
- [x] Reserve tickets during checkout
- [x] Generate order number

**Files to create:**
- `src/app/api/orders/route.ts`

#### TKT-008: Process Payment API (Stub)
- [x] Create `POST /api/orders/[id]/pay` endpoint
- [x] Call payment service (stub)
- [x] Update order status on success
- [x] Generate tickets
- [x] Send confirmation email
- [x] Release reservation if payment fails

**Files to create:**
- `src/app/api/orders/[id]/pay/route.ts`

#### TKT-009: Cancel Order API
- [x] Create `POST /api/orders/[id]/cancel` endpoint
- [x] Check cancellation deadline
- [x] Update order and ticket statuses
- [x] Restore ticket capacity
- [x] Flag for refund if paid

**Files to create:**
- `src/app/api/orders/[id]/cancel/route.ts`

#### TKT-010: Refund Order API (Organizer)
- [x] Create `POST /api/orders/[id]/refund` endpoint
- [x] Mark refund as pending
- [x] Record refund reason and notes
- [x] Send notification to buyer

**Files to create:**
- `src/app/api/orders/[id]/refund/route.ts`

### Priority 4: Order & Ticket UI

#### TKT-011: Ticket Selection Component
- [x] Display available ticket types
- [x] Quantity selectors with min/max limits
- [x] Price display and running total
- [x] Discount code input
- [x] Sold out / unavailable states

**Files to create:**
- `src/components/tickets/TicketSelector.tsx`
- `src/components/tickets/DiscountCodeInput.tsx`

#### TKT-012: Checkout Page
- [x] Buyer information form
- [x] Order summary
- [x] Payment method selection
- [x] PayPal button (stub)
- [x] Invoice option (if discount code)
- [x] Processing states

**Files to create:**
- `src/app/(public)/events/[slug]/checkout/page.tsx`
- `src/components/tickets/CheckoutForm.tsx`
- `src/components/tickets/OrderSummary.tsx`

#### TKT-013: Order Confirmation Page
- [x] Order details display
- [x] Ticket codes / QR codes
- [x] Download tickets as PDF (stretch)
- [x] Add to calendar links

**Files to create:**
- `src/app/(public)/orders/[orderNumber]/confirmation/page.tsx`
- `src/components/tickets/TicketDisplay.tsx`

#### TKT-014: User Orders Page
- [x] List user's orders
- [x] Order details view
- [x] Cancel order button (if within deadline)
- [x] View tickets

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
