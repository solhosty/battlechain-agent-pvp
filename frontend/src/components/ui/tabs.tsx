import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, defaultValue, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? '')
    const resolvedValue = value ?? internalValue
    const setValue = React.useCallback(
      (nextValue: string) => {
        if (value === undefined) {
          setInternalValue(nextValue)
        }
        onValueChange?.(nextValue)
      },
      [onValueChange, value],
    )

    return (
      <TabsContext.Provider value={{ value: resolvedValue, setValue }}>
        <div ref={ref} className={cn('w-full', className)} {...props} />
      </TabsContext.Provider>
    )
  },
)

Tabs.displayName = 'Tabs'

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('inline-flex h-10 items-center gap-2 rounded-md bg-muted p-1 text-muted-foreground', className)}
      {...props}
    />
  ),
)

TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (!context) {
      return null
    }

    const isActive = context.value === value

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => context.setValue(value)}
        className={cn(
          'inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition',
          isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          className,
        )}
        {...props}
      />
    )
  },
)

TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    if (!context || context.value !== value) {
      return null
    }

    return <div ref={ref} className={cn('mt-4', className)} {...props} />
  },
)

TabsContent.displayName = 'TabsContent'
