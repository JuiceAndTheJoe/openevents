import { Prisma, Role, EventStatus, EventVisibility, LocationType, OrderStatus, PaymentMethod, RefundStatus, TicketStatus, DiscountType, MediaType, TicketType } from '@prisma/client'

// Re-export Prisma enums for convenience
export { Role, EventStatus, EventVisibility, LocationType, OrderStatus, PaymentMethod, RefundStatus, TicketStatus, DiscountType, MediaType }

// ============================================================================
// User Types
// ============================================================================

export type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    roles: true
  }
}>

export type UserProfile = Prisma.UserGetPayload<{
  include: {
    roles: true
    organizerProfile: true
  }
}>

// ============================================================================
// Event Types
// ============================================================================

export type EventWithOrganizer = Prisma.EventGetPayload<{
  include: {
    organizer: true
  }
}>

export type EventWithDetails = Prisma.EventGetPayload<{
  include: {
    organizer: true
    media: true
    categories: {
      include: {
        category: true
      }
    }
    agendaItems: {
      include: {
        speaker: true
      }
    }
    speakers: true
    ticketTypes: true
  }
}>

export type EventListItem = Prisma.EventGetPayload<{
  include: {
    organizer: {
      select: {
        orgName: true
      }
    }
    categories: {
      include: {
        category: true
      }
    }
    _count: {
      select: {
        ticketTypes: true
      }
    }
  }
}>

export type EventForOrganizer = Prisma.EventGetPayload<{
  include: {
    ticketTypes: {
      select: {
        id: true
        name: true
        price: true
        maxCapacity: true
        soldCount: true
      }
    }
    _count: {
      select: {
        orders: true
      }
    }
  }
}>

// ============================================================================
// Ticket Types
// ============================================================================

export type TicketTypeWithAvailability = TicketType & {
  remainingCapacity: number | null
  isAvailable: boolean
}

export type DiscountCodeWithTicketTypes = Prisma.DiscountCodeGetPayload<{
  include: {
    ticketTypes: {
      include: {
        ticketType: true
      }
    }
  }
}>

// ============================================================================
// Order Types
// ============================================================================

export type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        ticketType: true
      }
    }
    tickets: true
    event: {
      select: {
        id: true
        title: true
        slug: true
        startDate: true
        endDate: true
        locationType: true
        venue: true
        address: true
        city: true
        country: true
        onlineUrl: true
        coverImage: true
      }
    }
    discountCode: {
      select: {
        code: true
        discountType: true
        discountValue: true
      }
    }
  }
}>

export type OrderListItem = Prisma.OrderGetPayload<{
  include: {
    event: {
      select: {
        title: true
        slug: true
        startDate: true
      }
    }
    _count: {
      select: {
        tickets: true
      }
    }
  }
}>

export type OrderForOrganizer = Prisma.OrderGetPayload<{
  include: {
    user: {
      select: {
        email: true
        firstName: true
        lastName: true
      }
    }
    items: {
      include: {
        ticketType: {
          select: {
            name: true
          }
        }
      }
    }
  }
}>

// ============================================================================
// Statistics Types
// ============================================================================

export interface EventStatistics {
  eventId: string
  totalTicketsSold: number
  totalRevenue: number
  currency: string
  ticketsByType: {
    ticketTypeId: string
    name: string
    sold: number
    revenue: number
    remaining: number | null
  }[]
  orderCount: number
  cancelledCount: number
  refundedCount: number
}

export interface DashboardStatistics {
  totalEvents: number
  publishedEvents: number
  draftEvents: number
  totalTicketsSold: number
  totalRevenue: number
  currency: string
  upcomingEvents: number
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
}

export interface ApiError {
  error: string
  message: string
  details?: Record<string, string[]>
}

export interface ApiSuccess<T = void> {
  success: true
  data?: T
  message?: string
}

// ============================================================================
// Search & Filter Types
// ============================================================================

export interface EventSearchParams {
  query?: string
  category?: string
  startDate?: string
  endDate?: string
  location?: string
  page?: number
  pageSize?: number
  sortBy?: 'date' | 'title' | 'price'
  sortOrder?: 'asc' | 'desc'
}

export interface OrderSearchParams {
  eventId?: string
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}
