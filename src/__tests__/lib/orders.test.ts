/**
 * Tests for order preparation and ticket generation utilities
 */
import { describe, it, expect, vi } from 'vitest'
import { prepareOrderItems, generateTicketCreateInput } from '@/lib/orders'
import { Prisma } from '@prisma/client'

// Mock generateTicketCode to return predictable values
vi.mock('@/lib/utils', () => ({
  generateTicketCode: vi.fn(() => 'MOCK-TICKET-CODE'),
}))

describe('Order Preparation Functions', () => {
  describe('prepareOrderItems', () => {
    const mockTicketTypes = [
      {
        id: 'tt-1',
        name: 'General Admission',
        price: new Prisma.Decimal(50),
        currency: 'SEK',
        minPerOrder: 1,
        maxPerOrder: 10,
      },
      {
        id: 'tt-2',
        name: 'VIP',
        price: new Prisma.Decimal(150.5),
        currency: 'SEK',
        minPerOrder: 1,
        maxPerOrder: 5,
      },
    ]

    it('should prepare single item order correctly', () => {
      const result = prepareOrderItems(mockTicketTypes, [
        { ticketTypeId: 'tt-1', quantity: 2 },
      ])

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toEqual({
        ticketTypeId: 'tt-1',
        ticketTypeName: 'General Admission',
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
        currency: 'SEK',
      })
      expect(result.subtotal).toBe(100)
    })

    it('should prepare multi-item order correctly', () => {
      const result = prepareOrderItems(mockTicketTypes, [
        { ticketTypeId: 'tt-1', quantity: 2 },
        { ticketTypeId: 'tt-2', quantity: 1 },
      ])

      expect(result.items).toHaveLength(2)
      expect(result.subtotal).toBe(250.5) // 100 + 150.5
    })

    it('should throw error for invalid ticket type', () => {
      expect(() =>
        prepareOrderItems(mockTicketTypes, [
          { ticketTypeId: 'invalid-id', quantity: 1 },
        ])
      ).toThrow('Ticket type invalid-id not found')
    })

    it('should throw error if quantity below minimum', () => {
      expect(() =>
        prepareOrderItems(mockTicketTypes, [
          { ticketTypeId: 'tt-1', quantity: 0 },
        ])
      ).toThrow('Minimum quantity for General Admission is 1')
    })

    it('should throw error if quantity above maximum', () => {
      expect(() =>
        prepareOrderItems(mockTicketTypes, [
          { ticketTypeId: 'tt-2', quantity: 10 },
        ])
      ).toThrow('Maximum quantity for VIP is 5')
    })

    it('should handle decimal prices correctly', () => {
      const result = prepareOrderItems(mockTicketTypes, [
        { ticketTypeId: 'tt-2', quantity: 3 },
      ])

      expect(result.items[0].unitPrice).toBe(150.5)
      expect(result.items[0].totalPrice).toBe(451.5) // 150.5 * 3
      expect(result.subtotal).toBe(451.5)
    })

    it('should include VAT in prepared prices when enabled', () => {
      const result = prepareOrderItems(
        mockTicketTypes,
        [{ ticketTypeId: 'tt-1', quantity: 2 }],
        { vatRate: 0.25 }
      )

      expect(result.items[0].unitPrice).toBe(62.5) // 50 * 1.25
      expect(result.items[0].totalPrice).toBe(125)
      expect(result.subtotal).toBe(125)
    })
  })

  describe('generateTicketCreateInput', () => {
    it('should generate correct number of tickets', () => {
      const tickets = generateTicketCreateInput('order-123', [
        {
          ticketTypeId: 'tt-1',
          ticketTypeName: 'General',
          quantity: 3,
          unitPrice: 50,
          totalPrice: 150,
          currency: 'SEK',
        },
      ])

      expect(tickets).toHaveLength(3)
      tickets.forEach((ticket) => {
        expect(ticket.orderId).toBe('order-123')
        expect(ticket.ticketTypeId).toBe('tt-1')
        expect(ticket.ticketCode).toBe('MOCK-TICKET-CODE')
      })
    })

    it('should include attendee data when provided', () => {
      const tickets = generateTicketCreateInput('order-123', [
        {
          ticketTypeId: 'tt-1',
          ticketTypeName: 'General',
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
          currency: 'SEK',
          attendees: [
            {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              title: 'Mr',
              organization: 'Acme Corp',
            },
            {
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane@example.com',
            },
          ],
        },
      ])

      expect(tickets).toHaveLength(2)

      expect(tickets[0].attendeeFirstName).toBe('John')
      expect(tickets[0].attendeeLastName).toBe('Doe')
      expect(tickets[0].attendeeEmail).toBe('john@example.com')
      expect(tickets[0].attendeeTitle).toBe('Mr')
      expect(tickets[0].attendeeOrganization).toBe('Acme Corp')

      expect(tickets[1].attendeeFirstName).toBe('Jane')
      expect(tickets[1].attendeeTitle).toBeUndefined()
    })

    it('should handle missing attendee data', () => {
      const tickets = generateTicketCreateInput('order-123', [
        {
          ticketTypeId: 'tt-1',
          ticketTypeName: 'General',
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
          currency: 'SEK',
          // No attendees array
        },
      ])

      expect(tickets).toHaveLength(2)
      expect(tickets[0].attendeeFirstName).toBeUndefined()
      expect(tickets[0].attendeeEmail).toBeUndefined()
    })

    it('should generate tickets across multiple item types', () => {
      const tickets = generateTicketCreateInput('order-123', [
        {
          ticketTypeId: 'tt-1',
          ticketTypeName: 'General',
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
          currency: 'SEK',
        },
        {
          ticketTypeId: 'tt-2',
          ticketTypeName: 'VIP',
          quantity: 1,
          unitPrice: 150,
          totalPrice: 150,
          currency: 'SEK',
        },
      ])

      expect(tickets).toHaveLength(3)
      expect(tickets.filter((t) => t.ticketTypeId === 'tt-1')).toHaveLength(2)
      expect(tickets.filter((t) => t.ticketTypeId === 'tt-2')).toHaveLength(1)
    })
  })
})
