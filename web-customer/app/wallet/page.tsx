'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { getEuroTokenReadContract } from '@/hooks/useContract'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatEURT } from '@/lib/utils'
import { COMPRA_EURT_URL } from '@/lib/addresses'

export default function WalletPage() {
  const { address, connect } = useWallet()
  const [balance, setBalance] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) { setBalance(null); return }
    setLoading(true)
    getEuroTokenReadContract().balanceOf(address)
      .then((b: bigint) => setBalance(b))
      .catch(() => setBalance(null))
      .finally(() => setLoading(false))
  }, [address])

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-zinc-400 text-lg">Conecta tu wallet para ver tu balance</p>
        <Button onClick={connect}>Conectar wallet</Button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-100">Mi Wallet</h1>

      <div className="rounded-xl border border-surface-border bg-surface-card p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-zinc-500">Dirección</p>
          <p className="font-mono text-sm text-zinc-300 break-all">{address}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-zinc-500">Balance EURT</p>
          {loading ? (
            <Skeleton className="h-9 w-40" />
          ) : balance !== null ? (
            <p className="text-3xl font-bold text-indigo-400">{formatEURT(balance)} EURT</p>
          ) : (
            <p className="text-sm text-zinc-400">No se pudo cargar el balance</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-6 space-y-3">
        <h2 className="font-semibold text-zinc-100">Comprar EuroTokens</h2>
        <p className="text-sm text-zinc-400">
          Compra EURT con tarjeta de crédito para pagar en la tienda.
          1 EURT = 1 EUR.
        </p>
        <a href={COMPRA_EURT_URL} target="_blank" rel="noopener noreferrer" className="block">
          <Button className="w-full">Comprar EURT con tarjeta →</Button>
        </a>
      </div>
    </div>
  )
}
