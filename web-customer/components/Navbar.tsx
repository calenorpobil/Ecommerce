'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { useCartItemCount } from '@/hooks/useCart'
import { Button } from '@/components/ui/Button'
import { formatAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/products', label: 'Productos' },
  { href: '/orders', label: 'Mis Pedidos' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/profile', label: 'Perfil' },
]

export function Navbar() {
  const pathname = usePathname()
  const { address, isConnecting, isCorrectNetwork, connect, disconnect } = useWallet()
  const cartCount = useCartItemCount(address)

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/products" className="text-sm font-semibold text-white">
              🛍️ E-commerce
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm transition-colors',
                    pathname === link.href
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                pathname === '/cart'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
              )}
            >
              🛒 Carrito
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            {address ? (
              <div className="flex items-center gap-2">
                {!isCorrectNetwork && (
                  <span className="text-xs text-yellow-400">Red incorrecta</span>
                )}
                <button
                  onClick={disconnect}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-mono"
                  title="Click para desconectar"
                >
                  {formatAddress(address)}
                </button>
              </div>
            ) : (
              <Button size="sm" onClick={connect} loading={isConnecting}>
                Conectar wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
