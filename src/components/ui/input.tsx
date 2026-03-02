import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const errorId = error && id ? `${id}-error` : undefined
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined

    return (
      <div className="w-full">
        <input
          id={id}
          type={type}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={describedBy}
          className={cn(
            'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
