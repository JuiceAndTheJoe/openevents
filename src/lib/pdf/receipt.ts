import PDFDocument from 'pdfkit'
import { formatPaymentMethodLabel } from '@/lib/payments/labels'
import { getIncludedVatFromVatInclusiveTotal } from '@/lib/pricing/vat'

export interface ReceiptData {
  orderNumber: string
  invoiceNumber: string | null  // Formatted sequential invoice number (e.g. "INV-0001"), null for non-invoice orders
  orderDate: Date
  paidAt: Date | null
  status: string
  paymentMethod: string | null
  currency: string

  seller: {
    // Legal entity name shown as the receipt issuer (e.g. "Eyevinn Technology AB")
    name: string
    // Optional brand/display name shown as "Organized by" in the event section
    displayName: string | null
    website: string | null
    orgNumber: string | null
    vatNumber: string | null
    address: string | null
  }

  buyer: {
    name: string
    email: string
    title: string | null
    organization: string | null
    address: string | null
    city: string | null
    postalCode: string | null
    country: string | null
  }

  event: {
    title: string
    startDate: Date
    location: string
  }

  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>

  subtotal: number
  discountAmount: number
  discountLabel: string | null
  vatRate: number
  vatAmount: number
  totalAmount: number
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function humanStatus(status: string): string {
  switch (status) {
    case 'PAID':
      return 'Paid'
    case 'PENDING_INVOICE':
      return 'Awaiting payment'
    case 'PENDING':
      return 'Pending'
    case 'REFUNDED':
      return 'Refunded'
    case 'PARTIALLY_REFUNDED':
      return 'Partially refunded'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return status
  }
}

function humanPaymentMethod(method: string | null): string {
  return formatPaymentMethodLabel(method, '—')
}

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageLeft = 50
    const pageRight = 545
    const colWidth = pageRight - pageLeft

    // ---- Header ----
    const isInvoice = data.invoiceNumber != null
    doc.fontSize(26).font('Helvetica-Bold').text(isInvoice ? 'INVOICE' : 'RECEIPT', pageLeft, 50)

    // Issuer block (legal entity issuing the receipt, from the event organizer)
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(data.seller.name, pageLeft, 82)
    doc.font('Helvetica').fillColor('#555')
    if (data.seller.orgNumber) {
      doc.text(`Org.nr: ${data.seller.orgNumber}`, pageLeft, doc.y)
    }
    if (data.seller.vatNumber) {
      doc.text(`VAT: ${data.seller.vatNumber}`, pageLeft, doc.y)
    }
    if (data.seller.address) {
      doc.text(data.seller.address, pageLeft, doc.y)
    }
    if (data.seller.website) {
      doc.text(data.seller.website, pageLeft, doc.y)
    }
    doc.fillColor('#000')

    // Right side: receipt/invoice metadata box
    const metaX = 360
    let metaY = 50
    // Value column starts 60pt after the label column, giving 125pt of space
    // (pageRight 545 − value start 420). This ensures the order number
    // "OE-XXXXXXXX-XXXX" (≈107pt) never wraps onto the next label row.
    const metaValX = metaX + 60
    const metaValueOpts = { lineBreak: false, width: pageRight - metaValX }
    if (isInvoice) {
      doc.fontSize(10).font('Helvetica-Bold').text('Invoice #', metaX, metaY)
      doc.font('Helvetica').text(data.invoiceNumber!, metaValX, metaY, metaValueOpts)
      metaY += 14
      doc.font('Helvetica-Bold').text('Receipt #', metaX, metaY)
      doc.font('Helvetica').text(data.orderNumber, metaValX, metaY, metaValueOpts)
    } else {
      doc.fontSize(10).font('Helvetica-Bold').text('Receipt #', metaX, metaY)
      doc.font('Helvetica').text(data.orderNumber, metaValX, metaY, metaValueOpts)
    }
    metaY += 14
    doc.font('Helvetica-Bold').text('Issued', metaX, metaY)
    doc.font('Helvetica').text(formatDate(new Date()), metaValX, metaY, metaValueOpts)
    metaY += 14
    doc.font('Helvetica-Bold').text('Order date', metaX, metaY)
    doc.font('Helvetica').text(formatDate(data.orderDate), metaValX, metaY, metaValueOpts)
    if (data.paidAt) {
      metaY += 14
      doc.font('Helvetica-Bold').text('Paid on', metaX, metaY)
      doc.font('Helvetica').text(formatDate(data.paidAt), metaValX, metaY, metaValueOpts)
    }
    metaY += 14
    doc.font('Helvetica-Bold').text('Status', metaX, metaY)
    doc.font('Helvetica').text(humanStatus(data.status), metaValX, metaY, metaValueOpts)
    metaY += 14
    doc.font('Helvetica-Bold').text('Payment', metaX, metaY)
    doc.font('Helvetica').text(humanPaymentMethod(data.paymentMethod), metaValX, metaY, metaValueOpts)

    // Move cursor below both columns
    doc.y = Math.max(120, metaY + 30)
    doc.x = pageLeft

    // Divider
    doc
      .strokeColor('#dddddd')
      .moveTo(pageLeft, doc.y)
      .lineTo(pageRight, doc.y)
      .stroke()
      .strokeColor('#000000')
    doc.moveDown(0.8)

    // ---- Billed To + Event (two columns) ----
    const twoColTop = doc.y
    const col1X = pageLeft
    const col2X = 310
    const col2Width = pageRight - col2X

    // Billed To
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333').text('BILLED TO', col1X, twoColTop)
    doc.fillColor('#000').moveDown(0.3)
    doc.fontSize(10).font('Helvetica-Bold')
    const buyerDisplayName = data.buyer.title
      ? `${data.buyer.title} ${data.buyer.name}`
      : data.buyer.name
    doc.text(buyerDisplayName, col1X, doc.y, { width: col2X - col1X - 10 })
    doc.font('Helvetica')
    if (data.buyer.organization) {
      doc.text(data.buyer.organization, col1X, doc.y, { width: col2X - col1X - 10 })
    }
    doc.text(data.buyer.email, col1X, doc.y, { width: col2X - col1X - 10 })
    if (data.buyer.address) {
      doc.text(data.buyer.address, col1X, doc.y, { width: col2X - col1X - 10 })
    }
    const cityLine = [data.buyer.postalCode, data.buyer.city].filter(Boolean).join(' ')
    if (cityLine) {
      doc.text(cityLine, col1X, doc.y, { width: col2X - col1X - 10 })
    }
    if (data.buyer.country) {
      doc.text(data.buyer.country, col1X, doc.y, { width: col2X - col1X - 10 })
    }
    const col1Bottom = doc.y

    // Event
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333').text('EVENT', col2X, twoColTop)
    doc.fillColor('#000').moveDown(0.3)
    doc.fontSize(10).font('Helvetica-Bold').text(data.event.title, col2X, doc.y, { width: col2Width })
    doc.font('Helvetica').text(formatDateTime(data.event.startDate), col2X, doc.y, { width: col2Width })
    doc.text(data.event.location, col2X, doc.y, { width: col2Width })
    const organizerDisplay = data.seller.displayName || data.seller.name
    if (organizerDisplay && organizerDisplay !== data.seller.name) {
      doc.text(`Organized by ${organizerDisplay}`, col2X, doc.y, { width: col2Width })
    }
    const col2Bottom = doc.y

    doc.y = Math.max(col1Bottom, col2Bottom)
    doc.x = pageLeft
    doc.moveDown(1.2)

    // ---- Items table ----
    doc
      .strokeColor('#dddddd')
      .moveTo(pageLeft, doc.y)
      .lineTo(pageRight, doc.y)
      .stroke()
      .strokeColor('#000000')
    doc.moveDown(0.4)

    const colItem = pageLeft
    const colQty = 320
    const colUnit = 380
    const colLine = 470

    // VAT-exclusive conversion: order.subtotal / totalAmount / unitPrice in the
    // database are stored VAT-inclusive (see src/lib/orders/index.ts), so we
    // convert back using the same cents-based rounding as
    // getIncludedVatFromVatInclusiveTotal in src/lib/pricing/vat.ts.
    const hasVat = data.vatRate > 0
    const toExVat = (vatInclusive: number): number => {
      if (!hasVat) return vatInclusive
      return Number(
        (vatInclusive - getIncludedVatFromVatInclusiveTotal(vatInclusive, data.vatRate)).toFixed(2)
      )
    }

    const unitPriceHeader = hasVat ? 'Unit price (excl. VAT)' : 'Unit price'
    const amountHeader = hasVat ? 'Amount (excl. VAT)' : 'Amount'

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#555')
    const headerY = doc.y
    doc.text('Description', colItem, headerY)
    doc.text('Qty', colQty, headerY, { width: 50, align: 'right' })
    doc.text(unitPriceHeader, colUnit, headerY, { width: 80, align: 'right' })
    doc.text(amountHeader, colLine, headerY, { width: pageRight - colLine, align: 'right' })
    doc.fillColor('#000')
    doc.moveDown(0.6)
    doc
      .strokeColor('#dddddd')
      .moveTo(pageLeft, doc.y)
      .lineTo(pageRight, doc.y)
      .stroke()
      .strokeColor('#000000')
    doc.moveDown(0.3)

    doc.font('Helvetica').fontSize(10)
    for (const item of data.items) {
      const unitPriceDisplay = toExVat(item.unitPrice)
      const lineTotalDisplay = toExVat(item.lineTotal)

      const rowY = doc.y
      doc.text(item.name, colItem, rowY, { width: colQty - colItem - 10 })
      const descBottom = doc.y
      doc.text(String(item.quantity), colQty, rowY, { width: 50, align: 'right' })
      doc.text(formatMoney(unitPriceDisplay, data.currency), colUnit, rowY, {
        width: 80,
        align: 'right',
      })
      doc.text(formatMoney(lineTotalDisplay, data.currency), colLine, rowY, {
        width: pageRight - colLine,
        align: 'right',
      })
      doc.y = Math.max(descBottom, rowY + 14)
      doc.moveDown(0.15)
    }

    doc
      .strokeColor('#dddddd')
      .moveTo(pageLeft, doc.y)
      .lineTo(pageRight, doc.y)
      .stroke()
      .strokeColor('#000000')
    doc.moveDown(0.4)

    // ---- Totals ----
    // Label column is wide enough to fit long discount descriptions without
    // wrapping onto two lines (e.g. "Discount (group 3+, 18.67% off)").
    const totalsLabelX = 270
    const totalsValueX = colLine
    const totalsWidth = pageRight - totalsValueX

    const writeTotalsRow = (label: string, value: string, bold = false) => {
      const rowY = doc.y
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
      doc.text(label, totalsLabelX, rowY, {
        width: totalsValueX - totalsLabelX - 10,
        align: 'right',
      })
      const labelBottom = doc.y
      doc.text(value, totalsValueX, rowY, { width: totalsWidth, align: 'right' })
      const valueBottom = doc.y
      // PDFKit's text() with an explicit y resets doc.y to the single-line end
      // position of the last call. If the label wrapped to more lines than the
      // value did, we need to advance past whichever line ended lower,
      // otherwise the next row overlaps the wrapped label.
      doc.y = Math.max(labelBottom, valueBottom)
      doc.moveDown(0.3)
    }

    // All totals are shown excl. VAT, with a separate VAT row, ending in the
    // VAT-inclusive grand total. For a 7500 SEK VAT-inclusive order at 25%
    // VAT: subtotal = 6000, VAT = 1500, total = 7500.
    const subtotalExVat = toExVat(data.subtotal)
    const discountExVat = toExVat(data.discountAmount)

    writeTotalsRow(
      hasVat ? 'Subtotal (excl. VAT)' : 'Subtotal',
      formatMoney(subtotalExVat, data.currency)
    )

    if (data.discountAmount > 0) {
      writeTotalsRow(
        data.discountLabel ? `Discount (${data.discountLabel})` : 'Discount',
        // ASCII hyphen only: PDFKit's Helvetica uses WinAnsi encoding, which
        // does not include U+2212 (Unicode minus). Using it would render as a
        // stray "quote" glyph next to the amount.
        `-${formatMoney(discountExVat, data.currency)}`
      )
    }

    if (hasVat) {
      const vatPercent = Math.round(data.vatRate * 100)
      writeTotalsRow(`VAT (${vatPercent}%)`, formatMoney(data.vatAmount, data.currency))
    }

    doc.moveDown(0.2)
    doc
      .strokeColor('#000000')
      .moveTo(totalsLabelX, doc.y)
      .lineTo(pageRight, doc.y)
      .stroke()
    doc.moveDown(0.3)

    writeTotalsRow('Total', formatMoney(data.totalAmount, data.currency), true)

    // ---- Footer ----
    doc.moveDown(2)
    doc.fontSize(9).font('Helvetica').fillColor('#666')
    const footerIssuer = data.seller.orgNumber
      ? `${data.seller.name} (Org.nr ${data.seller.orgNumber})`
      : data.seller.name
    const footerRef = data.invoiceNumber
      ? `Invoice ${data.invoiceNumber} (order #${data.orderNumber}) issued by ${footerIssuer}.`
      : `Receipt for order #${data.orderNumber} issued by ${footerIssuer}.`
    doc.text(footerRef, pageLeft, doc.y, { width: colWidth, align: 'center' })
    doc.text('Thank you for your purchase.', pageLeft, doc.y, {
      width: colWidth,
      align: 'center',
    })
    doc.fillColor('#000')

    doc.end()
  })
}
