import * as React from "react"
import { cn } from "./form-elements"

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
    ({ className, children, ...props }, ref) => (
      <div className="relative">
        <select
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-gray-300 appearance-none",
            className
          )}
          ref={ref}
          {...props}
        >
            {children}
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            ▼
        </span>
      </div>
    )
  )
  Select.displayName = "Select"

