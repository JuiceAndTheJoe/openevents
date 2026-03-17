'use client'

import { forwardRef, InputHTMLAttributes } from 'react'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  indeterminate?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, className = '', indeterminate, ...props }, ref) {
    return (
      <label className={`inline-flex items-center gap-2 ${className}`}>
        <input
          ref={(el) => {
            if (el) {
              el.indeterminate = indeterminate ?? false
            }
            if (typeof ref === 'function') {
              ref(el)
            } else if (ref) {
              ref.current = el
            }
          }}
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-[#5C8BD9] focus:ring-[#5C8BD9]"
          {...props}
        />
        {label ? <span className="text-sm text-gray-700">{label}</span> : null}
      </label>
    )
  }
)
