'use client'

import { useState } from 'react'
import { useCustomerInvoices, fetchInvoiceItems, type Invoice, type InvoiceItem } from '@/hooks/useInvoices'
import { useWallet } from '@/hooks/useWallet'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatEURT, formatDate, formatAddress } from '@/lib/utils'

export default function OrdersPage() {
  const { address, connect } = useWallet()
  const { invoices, loading, error, refetch } = useCustomerInvoices(address)

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-zinc-400 text-lg">Conecta tu wallet para ver tus pedidos</p>
        <Button onClick={connect}>Conectar wallet</Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/30 p-6 text-center text-red-400">
        Error al cargar pedidos: {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">Mis Pedidos</h1>
        <Button variant="ghost" size="sm" onClick={refetch}>
          Actualizar
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="py-16 text-center text-zinc-500">
          Todavía no tienes pedidos. ¡Compra algo!
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(invoice => (
            <InvoiceRow key={invoice.invoiceId.toString()} invoice={invoice} />
          ))}
        </div>
      )}
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<InvoiceItem[] | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)

  async function toggleItems() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (items !== null) return
    setLoadingItems(true)
    try {
      const data = await fetchInvoiceItems(invoice.invoiceId)
      setItems(data)
    } catch {
      toast('Error al cargar los items de la factura', 'error')
    } finally {
      setLoadingItems(false)
    }
  }

  const statusBadge = invoice.isRefunded
    ? <Badge variant="zinc">Reembolsada</Badge>
    : invoice.isPaid
    ? <Badge variant="green">Pagada</Badge>
    : <Badge variant="yellow">Pendiente</Badge>

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <button
        onClick={toggleItems}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">
              Factura #{invoice.invoiceId.toString()}
            </span>
            {statusBadge}
          </div>
          <p className="text-xs text-zinc-500">
            {formatDate(invoice.timestamp)} · Empresa #{invoice.companyId.toString()}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-indigo-400">{formatEURT(invoice.totalAmount)} EURT</p>
        </div>

        <span className="text-zinc-500 text-sm ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-surface-border p-4 space-y-3">
          {loadingItems ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : items && items.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-surface-border">
                  <th className="pb-2 text-left font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Cant.</th>
                  <th className="pb-2 text-right font-medium">Precio/ud.</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {items.map((item, i) => (
                  <tr key={i} className="text-zinc-300">
                    <td className="py-2">{item.productName}</td>
                    <td className="py-2 text-right">{item.quantity.toString()}</td>
                    <td className="py-2 text-right">{formatEURT(item.unitPrice)} EURT</td>
                    <td className="py-2 text-right font-medium text-indigo-400">
                      {formatEURT(item.totalPrice)} EURT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-zinc-500">Sin items</p>
          )}

          {invoice.isPaid && invoice.paymentTxHash && (
            <div className="pt-2 text-xs text-zinc-500">
              <span>Tx: </span>
              <span className="font-mono text-zinc-400">{formatAddress(invoice.paymentTxHash)}</span>
            </div>
          )}

          {!invoice.isPaid && !invoice.isRefunded && (
            <div className="pt-2 text-xs text-yellow-500">
              Esta factura está pendiente de pago. Ve a la pasarela para completar el pago.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
