import * as React from 'react'
import { cn } from '@/lib/utils'

export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('animate-shimmer rounded-md bg-muted/60 bg-[length:200%_100%]', className)}
      {...props}
    />
  ),
)

Skeleton.displayName = 'Skeleton'
