import { Toaster as Sonner } from 'sonner'

export const Toaster = () => (
  <Sonner
    theme="dark"
    position="top-right"
    toastOptions={{
      classNames: {
        toast: 'bg-card border border-border text-foreground shadow-lg',
        description: 'text-muted-foreground',
        actionButton: 'bg-primary text-primary-foreground',
        cancelButton: 'bg-muted text-muted-foreground',
      },
    }}
  />
)
