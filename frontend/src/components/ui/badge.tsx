import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold transition',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary border-transparent',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        success: 'bg-emerald-500/15 text-emerald-200 border-transparent',
        warning: 'bg-amber-500/15 text-amber-200 border-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
)

Badge.displayName = 'Badge'

export { badgeVariants }
