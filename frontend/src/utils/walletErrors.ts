export const formatWalletError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes('user rejected') || lower.includes('denied')) {
    return 'Transaction rejected in wallet.'
  }

  if (
    lower.includes('wrong network') ||
    lower.includes('unsupported chain') ||
    lower.includes('chain mismatch') ||
    lower.includes('chain id')
  ) {
    return 'Wrong network. Switch networks in your wallet.'
  }

  if (lower.includes('replacement') || lower.includes('nonce')) {
    return 'Pending tx detected. Speed up or cancel in your wallet, or increase gas.'
  }

  if (lower.includes('insufficient funds')) {
    return 'Insufficient funds for gas.'
  }

  if (lower.includes('timeout')) {
    return 'RPC timeout — try again.'
  }

  return message
}
