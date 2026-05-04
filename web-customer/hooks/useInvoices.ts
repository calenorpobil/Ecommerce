'use client'

import { useState, useEffect, useCallback } from 'react'
import { getReadContract } from './useContract'

export interface InvoiceItem {
  productId: bigint
  productName: string
  quantity: bigint
  unitPrice: bigint
  totalPrice: bigint
}

export interface Invoice {
  invoiceId: bigint
  companyId: bigint
  customerAddress: string
  totalAmount: bigint
  timestamp: bigint
  isPaid: boolean
  isRefunded: boolean
  paymentTxHash: string
}

export function useCustomerInvoices(customerAddress: string | null) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    if (!customerAddress) {
      setInvoices([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const contract = getReadContract()
      const ids: bigint[] = await contract.getCustomerInvoices(customerAddress)
      const data = await Promise.all(ids.map(id => contract.getInvoice(id)))
      setInvoices(
        data.map(inv => ({
          invoiceId: inv.invoiceId,
          companyId: inv.companyId,
          customerAddress: inv.customerAddress,
          totalAmount: inv.totalAmount,
          timestamp: inv.timestamp,
          isPaid: inv.isPaid,
          isRefunded: inv.isRefunded,
          paymentTxHash: inv.paymentTxHash,
        })).sort((a, b) => Number(b.timestamp - a.timestamp))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar facturas')
    } finally {
      setLoading(false)
    }
  }, [customerAddress])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  return { invoices, loading, error, refetch: fetchInvoices }
}

export async function fetchInvoiceItems(invoiceId: bigint): Promise<InvoiceItem[]> {
  const contract = getReadContract()
  const items = await contract.getInvoiceItems(invoiceId)
  return (items as {
    productId: bigint
    productName: string
    quantity: bigint
    unitPrice: bigint
    totalPrice: bigint
  }[]).map(i => ({
    productId: i.productId,
    productName: i.productName,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    totalPrice: i.totalPrice,
  }))
}
