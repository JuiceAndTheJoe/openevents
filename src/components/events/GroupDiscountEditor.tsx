'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TicketType {
  id: string
  name: string
}

interface GroupDiscount {
  id: string
  ticketTypeId: string | null
  ticketTypeName: string
  minQuantity: number
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  isActive: boolean
}

interface GroupDiscountEditorProps {
  eventId: string
  ticketTypes: TicketType[]
}

export function GroupDiscountEditor({ eventId, ticketTypes }: GroupDiscountEditorProps) {
  const [discounts, setDiscounts] = useState<GroupDiscount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Form state for new discount
  const [newDiscount, setNewDiscount] = useState({
    ticketTypeId: '',
    minQuantity: 2,
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    discountValue: 10,
    isActive: true,
  })

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<GroupDiscount | null>(null)

  useEffect(() => {
    fetchDiscounts()
  }, [eventId])

  async function fetchDiscounts() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/events/${eventId}/group-discounts`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load group discounts')
      }

      setDiscounts(data.groupDiscounts)
    } catch (err) {
      console.error('Failed to fetch group discounts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load discounts')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    try {
      setIsCreating(true)
      setError(null)

      const response = await fetch(`/api/events/${eventId}/group-discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketTypeId: newDiscount.ticketTypeId || null,
          minQuantity: newDiscount.minQuantity,
          discountType: newDiscount.discountType,
          discountValue: newDiscount.discountValue,
          isActive: newDiscount.isActive,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create group discount')
      }

      // Reset form
      setNewDiscount({
        ticketTypeId: '',
        minQuantity: 2,
        discountType: 'PERCENTAGE',
        discountValue: 10,
        isActive: true,
      })

      // Refresh list
      await fetchDiscounts()
    } catch (err) {
      console.error('Failed to create discount:', err)
      setError(err instanceof Error ? err.message : 'Failed to create discount')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdate(discountId: string) {
    if (!editForm) return

    try {
      setError(null)

      const response = await fetch(`/api/events/${eventId}/group-discounts/${discountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketTypeId: editForm.ticketTypeId || null,
          minQuantity: editForm.minQuantity,
          discountType: editForm.discountType,
          discountValue: editForm.discountValue,
          isActive: editForm.isActive,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update group discount')
      }

      setEditingId(null)
      setEditForm(null)
      await fetchDiscounts()
    } catch (err) {
      console.error('Failed to update discount:', err)
      setError(err instanceof Error ? err.message : 'Failed to update discount')
    }
  }

  async function handleDelete(discountId: string) {
    if (!confirm('Are you sure you want to delete this group discount?')) {
      return
    }

    try {
      setError(null)

      const response = await fetch(`/api/events/${eventId}/group-discounts/${discountId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete group discount')
      }

      await fetchDiscounts()
    } catch (err) {
      console.error('Failed to delete discount:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete discount')
    }
  }

  async function handleToggleActive(discount: GroupDiscount) {
    try {
      setError(null)

      const response = await fetch(`/api/events/${eventId}/group-discounts/${discount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !discount.isActive,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to toggle discount status')
      }

      await fetchDiscounts()
    } catch (err) {
      console.error('Failed to toggle discount:', err)
      setError(err instanceof Error ? err.message : 'Failed to toggle discount')
    }
  }

  function startEdit(discount: GroupDiscount) {
    setEditingId(discount.id)
    setEditForm({ ...discount })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-gray-500">Loading group discounts...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Group Discount</CardTitle>
          <p className="text-sm text-gray-500">
            Automatically discount tickets when customers buy in bulk
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-ticket-type">Ticket Type (Optional)</Label>
              <select
                id="new-ticket-type"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={newDiscount.ticketTypeId}
                onChange={(e) => setNewDiscount({ ...newDiscount, ticketTypeId: e.target.value })}
              >
                <option value="">All Ticket Types</option>
                {ticketTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">Leave blank to apply to all ticket types</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-min-quantity" required>
                Minimum Quantity
              </Label>
              <Input
                id="new-min-quantity"
                type="number"
                min="2"
                value={newDiscount.minQuantity}
                onChange={(e) =>
                  setNewDiscount({ ...newDiscount, minQuantity: parseInt(e.target.value) || 2 })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-discount-type" required>
                Discount Type
              </Label>
              <select
                id="new-discount-type"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={newDiscount.discountType}
                onChange={(e) =>
                  setNewDiscount({
                    ...newDiscount,
                    discountType: e.target.value as 'PERCENTAGE' | 'FIXED',
                  })
                }
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed Amount</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-discount-value" required>
                Discount Value
              </Label>
              <Input
                id="new-discount-value"
                type="number"
                min="0"
                step="0.01"
                value={newDiscount.discountValue}
                onChange={(e) =>
                  setNewDiscount({
                    ...newDiscount,
                    discountValue: parseFloat(e.target.value) || 0,
                  })
                }
                required
              />
              <p className="text-xs text-gray-500">
                {newDiscount.discountType === 'PERCENTAGE' ? 'Percentage (e.g., 10 for 10%)' : 'Fixed amount'}
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Add Discount Tier'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Discount Tiers</CardTitle>
          <p className="text-sm text-gray-500">
            Tiers are sorted by minimum quantity. The best matching tier applies automatically.
          </p>
        </CardHeader>
        <CardContent>
          {discounts.length === 0 ? (
            <p className="text-sm text-gray-500">
              No group discounts configured. Add one above to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {discounts.map((discount) => (
                <div
                  key={discount.id}
                  className={`rounded-lg border p-4 ${
                    discount.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  {editingId === discount.id && editForm ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Ticket Type</Label>
                          <select
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            value={editForm.ticketTypeId || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, ticketTypeId: e.target.value || null })
                            }
                          >
                            <option value="">All Ticket Types</option>
                            {ticketTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label>Minimum Quantity</Label>
                          <Input
                            type="number"
                            min="2"
                            value={editForm.minQuantity}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                minQuantity: parseInt(e.target.value) || 2,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label>Discount Type</Label>
                          <select
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            value={editForm.discountType}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                discountType: e.target.value as 'PERCENTAGE' | 'FIXED',
                              })
                            }
                          >
                            <option value="PERCENTAGE">Percentage</option>
                            <option value="FIXED">Fixed Amount</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label>Discount Value</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.discountValue}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                discountValue: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={() => handleUpdate(discount.id)} size="sm">
                          Save
                        </Button>
                        <Button onClick={cancelEdit} variant="outline" size="sm">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">
                          {discount.ticketTypeName}
                        </p>
                        <p className="text-sm text-gray-600">
                          Buy {discount.minQuantity}+ tickets, get{' '}
                          {discount.discountType === 'PERCENTAGE'
                            ? `${discount.discountValue}%`
                            : `$${discount.discountValue}`}{' '}
                          off
                        </p>
                        <p className="text-xs text-gray-500">
                          Status: {discount.isActive ? 'Active' : 'Inactive'}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleToggleActive(discount)}
                          variant="outline"
                          size="sm"
                        >
                          {discount.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button onClick={() => startEdit(discount)} variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(discount.id)}
                          variant="outline"
                          size="sm"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
