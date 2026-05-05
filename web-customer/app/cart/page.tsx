'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart, resolveCartCompanyId } from '@/hooks/useCart'
import { useWallet } from '@/hooks/useWallet'
import { getWriteContract } from '@/hooks/useContract'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatEURT, parseRevertReason } from '@/lib/utils'
import { PAYMENT_GATEWAY_URL } from '@/lib/addresses'

export default function CartPage() {
  const router = useRouter()
  const toast = useToast()
  const { address, connect } = useWallet()
  const { items, total, loading, actionLoading, updateQuantity, removeFromCart, error } = useCart(address)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  async function handleCheckout() {
    if (!address) {
      await connect()
      return
    }
    if (items.length === 0) {
      toast('El carrito está vacío', 'error')
      return
    }

    setCheckoutLoading(true)
    try {
      const companyInfo = await resolveCartCompanyId(items)
      if (!companyInfo) {
        toast('El carrito tiene productos de varias empresas. Por favor compra de una empresa a la vez.', 'error')
        setCheckoutLoading(false)
        return
      }

      const contract = await getWriteContract()
      const tx = await contract.createInvoice(companyInfo.companyId)
      const receipt = await tx.wait()

      // Extract invoiceId from InvoiceCreated event
      let invoiceId: bigint | null = null
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log)
          if (parsed?.name === 'InvoiceCreated') {
            invoiceId = parsed.args.invoiceId as bigint
            break
          }
        } catch {
          // not this event
        }
      }

      if (invoiceId === null) {
        toast('Factura creada pero no se pudo leer el ID. Ve a Mis Pedidos.', 'info')
        router.push('/orders')
        return
      }

      toast('Factura creada. Redirigiendo a la pasarela de pago…', 'success')

      const params = new URLSearchParams({
        merchant_address: companyInfo.companyAddress,
        amount: formatEURT(total),
        invoice: invoiceId.toString(),
        date: new Date().toISOString().split('T')[0],
        redirect: `${window.location.origin}/orders`,
      })

      router.push(`${PAYMENT_GATEWAY_URL}?${params.toString()}`)
    } catch (e) {
      toast(parseRevertReason(e), 'error')
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-zinc-400 text-lg">Conecta tu wallet para ver el carrito</p>
        <Button onClick={connect}>Conectar wallet</Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-4xl">🛒</p>
        <p className="text-zinc-400 text-lg">Tu carrito está vacío</p>
        <Link href="/products">
          <Button variant="secondary">Ver productos</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <h1 className="text-xl font-semibold text-zinc-100">Carrito</h1>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {items.map(item => (
          <div
            key={item.productId.toString()}
            className="flex items-center gap-4 rounded-xl border border-surface-border bg-surface-card p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100">Producto #{item.productId.toString()}</p>
              <p className="text-xs text-zinc-500">{formatEURT(item.unitPrice)} EURT / ud.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={actionLoading}
                onClick={() => updateQuantity(item.productId, item.quantity - BigInt(1))}
                className="h-7 w-7 rounded border border-surface-border bg-surface-hover text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition-colors text-sm flex items-center justify-center"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-medium text-zinc-100">
                {item.quantity.toString()}
              </span>
              <button
                disabled={actionLoading}
                onClick={() => updateQuantity(item.productId, item.quantity + BigInt(1))}
                className="h-7 w-7 rounded border border-surface-border bg-surface-hover text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition-colors text-sm flex items-center justify-center"
              >
                +
              </button>
            </div>

            <div className="w-24 text-right">
              <p className="text-sm font-semibold text-indigo-400">
                {formatEURT(item.quantity * item.unitPrice)} EURT
              </p>
            </div>

            <button
              disabled={actionLoading}
              onClick={() => removeFromCart(item.productId)}
              className="text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors text-lg leading-none"
              title="Eliminar"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="lg:col-span-1">
        <div className="sticky top-20 rounded-xl border border-surface-border bg-surface-card p-6 space-y-4">
          <h2 className="font-semibold text-zinc-100">Resumen del pedido</h2>

          <div className="flex justify-between text-sm text-zinc-400">
            <span>Subtotal ({items.length} {items.length === 1 ? 'producto' : 'productos'})</span>
            <span>{formatEURT(total)} EURT</span>
          </div>

          <div className="border-t border-surface-border pt-3 flex justify-between font-semibold text-zinc-100">
            <span>Total</span>
            <span>{formatEURT(total)} EURT</span>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            loading={checkoutLoading}
            disabled={actionLoading}
          >
            Pagar con EURT
          </Button>

          <p className="text-xs text-zinc-500 text-center">
            Serás redirigido a la pasarela de pago
          </p>
        </div>
      </div>
    </div>
  )
}
