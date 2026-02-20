'use client'

import { QRCodeSVG } from 'qrcode.react'

interface TicketQRCodeProps {
  ticketCode: string
  size?: number
}

export function TicketQRCode({ ticketCode, size = 80 }: TicketQRCodeProps) {
  return (
    <div className="flex-shrink-0 rounded bg-white p-1">
      <QRCodeSVG
        value={ticketCode}
        size={size}
        level="M"
        includeMargin={false}
      />
    </div>
  )
}
