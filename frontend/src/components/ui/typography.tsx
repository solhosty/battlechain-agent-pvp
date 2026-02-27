import * as React from 'react'
import { cn } from '@/lib/utils'

type HeadingSize = 'hero' | 'h1' | 'h2' | 'h3'
type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4'

const headingStyles: Record<HeadingSize, string> = {
  hero: 'text-hero font-semibold tracking-tight text-foreground',
  h1: 'text-h1 font-semibold tracking-tight text-foreground',
  h2: 'text-h2 font-semibold tracking-tight text-foreground',
  h3: 'text-xl font-semibold tracking-tight text-foreground',
}

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  size?: HeadingSize
  as?: HeadingElement
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ size = 'h2', as = 'h2', className, ...props }, ref) => {
    const Component = as
    return (
      <Component ref={ref} className={cn(headingStyles[size], className)} {...props} />
    )
  },
)

Heading.displayName = 'Heading'

type TextTone = 'default' | 'muted' | 'accent'
type TextElement = 'p' | 'span' | 'div'

const textToneStyles: Record<TextTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  accent: 'text-primary',
}

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  tone?: TextTone
  as?: TextElement
}

export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ tone = 'default', as = 'p', className, ...props }, ref) => {
    const Component = as
    return (
      <Component
        ref={ref}
        className={cn('text-body', textToneStyles[tone], className)}
        {...props}
      />
    )
  },
)

Text.displayName = 'Text'

type LabelElement = 'span' | 'p' | 'label'

export interface LabelProps extends React.HTMLAttributes<HTMLElement> {
  as?: LabelElement
}

export const Label = React.forwardRef<HTMLElement, LabelProps>(
  ({ as = 'span', className, ...props }, ref) => {
    const Component = as
    return (
      <Component
        ref={ref}
        className={cn(
          'text-xs font-semibold uppercase tracking-label text-muted-foreground',
          className,
        )}
        {...props}
      />
    )
  },
)

Label.displayName = 'Label'

type CaptionElement = 'span' | 'p'

export interface CaptionProps extends React.HTMLAttributes<HTMLElement> {
  as?: CaptionElement
}

export const Caption = React.forwardRef<HTMLElement, CaptionProps>(
  ({ as = 'p', className, ...props }, ref) => {
    const Component = as
    return (
      <Component ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />
    )
  },
)

Caption.displayName = 'Caption'
