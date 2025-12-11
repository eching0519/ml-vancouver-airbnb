import * as React from "react";
import { cn } from "./form-elements";

// Simple checkbox since radix-ui is not installed, I'll make a custom one or just standard input for speed,
// but user asked for "well designed". I'll implement a custom styled checkbox using standard input wrapped.

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 accent-slate-900",
      className
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";
