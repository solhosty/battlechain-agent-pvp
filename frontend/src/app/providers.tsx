'use client'

import React, { useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { WagmiProvider } from 'wagmi'
import { Toaster } from '@/components/ui/toaster'
import { wagmiConfig } from '@/utils/wagmiConfig'

type ErrorBoundaryState = {
  hasError: boolean
}

class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('App error boundary:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-lg">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Please refresh the page. If the issue persists, reconnect your
              wallet and try again.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), [])
  const wagmiConfigMemo = useMemo(() => wagmiConfig, [])

  return (
    <WagmiProvider config={wagmiConfigMemo}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <AppErrorBoundary>
            {children}
            <Toaster />
          </AppErrorBoundary>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
