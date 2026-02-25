import * as React from 'react'
import { cn } from '@/lib/utils'

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined)

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export const Dialog = ({ open, defaultOpen, onOpenChange, children }: DialogProps) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const resolvedOpen = open ?? internalOpen

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) {
        setInternalOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [onOpenChange, open],
  )

  return <DialogContext.Provider value={{ open: resolvedOpen, setOpen }}>{children}</DialogContext.Provider>
}

export const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const context = React.useContext(DialogContext)
  if (!context) {
    return null
  }

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={(event) => {
        onClick?.(event)
        context.setOpen(true)
      }}
      {...props}
    />
  )
})

DialogTrigger.displayName = 'DialogTrigger'

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(DialogContext)
  if (!context?.open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => context.setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
})

DialogContent.displayName = 'DialogContent'

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2', className)} {...props} />
)

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
))

DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))

DialogDescription.displayName = 'DialogDescription'

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2 sm:flex-row sm:justify-end', className)} {...props} />
)
