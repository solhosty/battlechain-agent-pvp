import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { NavLink } from 'react-router-dom'
import { useAccount } from 'wagmi'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/studio', label: 'Studio' },
  { to: '/spectate', label: 'Spectate' },
]

const AppNav = () => {
  const { address } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) => {
    const base =
      'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors '
    const active = 'bg-muted text-foreground'
    const inactive =
      'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
    return `${base}${isActive ? active : inactive}`
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <NavLink
            to="/"
            className="text-lg font-semibold text-foreground"
            onClick={() => setMenuOpen(false)}
          >
            BattleChain
          </NavLink>
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                onClick={show}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : 'Connect Wallet'}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-3 py-2 text-foreground transition-colors hover:bg-muted/70 md:hidden"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <div className="flex flex-col gap-1">
            <span className="block h-0.5 w-5 bg-foreground" />
            <span className="block h-0.5 w-5 bg-foreground" />
            <span className="block h-0.5 w-5 bg-foreground" />
          </div>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-2 pt-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="pt-4">
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    show()
                  }}
                  className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  {address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : 'Connect Wallet'}
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        </div>
      )}
    </nav>
  )
}

export default AppNav
