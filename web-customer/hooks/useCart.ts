'use client'

import { useState, useEffect, useCallback } from 'react'
import { getReadContract, getWriteContract } from './useContract'
import { parseRevertReason } from '@/lib/utils'

export interface CartItem {
  productId: bigint
  quantity: bigint
  unitPrice: bigint
}

export function useCart(walletAddress?: string | null) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCart = useCallback(async () => {
    if (!walletAddress) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      // getCart() uses msg.sender — call via staticCall with from override
      const contract = getReadContract()
      const raw = await contract.getCart.staticCall({ from: walletAddress })
      setItems(
        (raw as { productId: bigint; quantity: bigint; unitPrice: bigint }[]).map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el carrito')
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const addToCart = useCallback(async (productId: bigint, quantity: bigint): Promise<boolean> => {
    setActionLoading(true)
    setError(null)
    try {
      const contract = await getWriteContract()
      const tx = await contract.addToCart(productId, quantity)
      await tx.wait()
      await fetchCart()
      return true
    } catch (e) {
      setError(parseRevertReason(e))
      return false
    } finally {
      setActionLoading(false)
    }
  }, [fetchCart])

  const updateQuantity = useCallback(async (productId: bigint, quantity: bigint): Promise<boolean> => {
    if (quantity <= BigInt(0)) {
      return removeFromCart(productId)
    }
    setActionLoading(true)
    setError(null)
    try {
      const contract = await getWriteContract()
      const tx = await contract.updateCartQuantity(productId, quantity)
      await tx.wait()
      await fetchCart()
      return true
    } catch (e) {
      setError(parseRevertReason(e))
      return false
    } finally {
      setActionLoading(false)
    }
  }, [fetchCart]) // eslint-disable-line react-hooks/exhaustive-deps

  const removeFromCart = useCallback(async (productId: bigint): Promise<boolean> => {
    setActionLoading(true)
    setError(null)
    try {
      const contract = await getWriteContract()
      const tx = await contract.removeFromCart(productId)
      await tx.wait()
      await fetchCart()
      return true
    } catch (e) {
      setError(parseRevertReason(e))
      return false
    } finally {
      setActionLoading(false)
    }
  }, [fetchCart])

  const total = items.reduce((acc, item) => acc + item.quantity * item.unitPrice, BigInt(0))

  return {
    items,
    total,
    loading,
    actionLoading,
    error,
    addToCart,
    updateQuantity,
    removeFromCart,
    refetch: fetchCart,
  }
}

export function useCartTotal(walletAddress?: string | null) {
  const [total, setTotal] = useState<bigint>(BigInt(0))

  useEffect(() => {
    if (!walletAddress) return
    const contract = getReadContract()
    contract.calculateTotal.staticCall({ from: walletAddress })
      .then((v: unknown) => setTotal(v as bigint))
      .catch(() => setTotal(BigInt(0)))
  }, [walletAddress])

  return total
}

// Thin hook just for item count — used by Navbar without full cart data
export function useCartItemCount(walletAddress?: string | null) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!walletAddress) { setCount(0); return }
    try {
      const contract = getReadContract()
      const raw = await contract.getCart.staticCall({ from: walletAddress })
      setCount((raw as unknown[]).length)
    } catch {
      setCount(0)
    }
  }, [walletAddress])

  useEffect(() => { refresh() }, [refresh])

  return count
}

// Helper to derive unique companyId from cart items using the main contract
export async function resolveCartCompanyId(
  items: CartItem[]
): Promise<{ companyId: bigint; companyAddress: string } | null> {
  if (items.length === 0) return null
  const contract = getReadContract()
  const products = await Promise.all(items.map(i => contract.getProduct(i.productId)))
  const companyIds = [...new Set(products.map((p: { companyId: bigint }) => p.companyId.toString()))]
  if (companyIds.length !== 1) return null // mixed companies

  const companyId = products[0].companyId as bigint
  const company = await contract.getCompany(companyId)
  return { companyId, companyAddress: company.companyAddress as string }
}
