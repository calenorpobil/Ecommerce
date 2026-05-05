'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { useCustomerInvoices, fetchInvoiceItems } from '@/hooks/useInvoices'
import { getReadContract } from '@/hooks/useContract'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatEURT, formatDate, formatAddress } from '@/lib/utils'

interface CustomerStats {
  customerAddress: string
  totalPurchases: bigint
  totalSpent: bigint
  registrationDate: bigint
  lastPurchaseDate: bigint
  isActive: boolean
}

export default function ProfilePage() {
  const { address, connect } = useWallet()
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const { invoices } = useCustomerInvoices(address)

  useEffect(() => {
    if (!address) { setStats(null); return }
    setStatsLoading(true)
    getReadContract().getCustomer(address)
      .then((c: CustomerStats) => setStats(c))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [address])

  async function downloadInvoicesCSV() {
    if (!invoices.length || !address) return
    setDownloading(true)
    try {
      const rows: string[][] = [
        ['Factura', 'Empresa', 'Fecha', 'Total (EURT)', 'Estado', 'Tx Hash'],
      ]
      for (const inv of invoices) {
        let items: Awaited<ReturnType<typeof fetchInvoiceItems>> = []
        try { items = await fetchInvoiceItems(inv.invoiceId) } catch { /* skip items on error */ }
        const status = inv.isRefunded ? 'Reembolsada' : inv.isPaid ? 'Pagada' : 'Pendiente'
        rows.push([
          inv.invoiceId.toString(),
          inv.companyId.toString(),
          formatDate(inv.timestamp),
          formatEURT(inv.totalAmount),
          status,
          inv.paymentTxHash || '',
        ])
        for (const item of items) {
          rows.push([
            `  -> ${item.productName}`,
            '',
            '',
            formatEURT(item.totalPrice),
            `x${item.quantity.toString()}`,
            '',
          ])
        }
      }
      const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `facturas-${formatAddress(address)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-zinc-400 text-lg">Conecta tu wallet para ver tu perfil</p>
        <Button onClick={connect}>Conectar wallet</Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-100">Mi Perfil</h1>

      <div className="rounded-xl border border-surface-border bg-surface-card p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-zinc-500">Dirección</p>
          <p className="font-mono text-sm text-zinc-300 break-all">{address}</p>
        </div>

        {statsLoading ? (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : stats && stats.isActive ? (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-0.5">
              <p className="text-xs text-zinc-500">Total compras</p>
              <p className="text-2xl font-bold text-zinc-100">{stats.totalPurchases.toString()}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-zinc-500">Total gastado</p>
              <p className="text-2xl font-bold text-indigo-400">{formatEURT(stats.totalSpent)} EURT</p>
            </div>
            {stats.registrationDate > 0n && (
              <div className="space-y-0.5">
                <p className="text-xs text-zinc-500">Cliente desde</p>
                <p className="text-sm text-zinc-300">{formatDate(stats.registrationDate)}</p>
              </div>
            )}
            {stats.lastPurchaseDate > 0n && (
              <div className="space-y-0.5">
                <p className="text-xs text-zinc-500">Última compra</p>
                <p className="text-sm text-zinc-300">{formatDate(stats.lastPurchaseDate)}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 pt-2">
            Aún no tienes historial de compras. ¡Realiza tu primera compra!
          </p>
        )}
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-6 space-y-3">
        <h2 className="font-semibold text-zinc-100">Mis Facturas</h2>
        <p className="text-sm text-zinc-400">
          {invoices.length > 0
            ? `${invoices.length} factura${invoices.length !== 1 ? 's' : ''} en tu historial`
            : 'Aún no tienes facturas'}
        </p>
        <div className="flex gap-3 flex-wrap">
          <Link href="/orders">
            <Button variant="secondary">Ver facturas</Button>
          </Link>
          {invoices.length > 0 && (
            <Button variant="ghost" onClick={downloadInvoicesCSV} loading={downloading}>
              Descargar CSV
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
