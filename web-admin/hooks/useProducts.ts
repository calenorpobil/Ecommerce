'use client'

import { useState, useEffect, useCallback } from 'react'
import { getReadContract } from './useContract'

export interface Product {
  productId: bigint
  companyId: bigint
  name: string
  description: string
  price: bigint
  stock: bigint
  ipfsImageHash: string
  isActive: boolean
  createdAt: bigint
}

export function useProducts(companyId: bigint | null) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    if (companyId === null) {
      setProducts([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const contract = getReadContract()
      const ids: bigint[] = await contract.getProductsByCompany(companyId)
      const items = await Promise.all(ids.map(id => contract.getProduct(id)))
      setProducts(
        items.map(p => ({
          productId: p.productId,
          companyId: p.companyId,
          name: p.name,
          description: p.description,
          price: p.price,
          stock: p.stock,
          ipfsImageHash: p.ipfsImageHash,
          isActive: p.isActive,
          createdAt: p.createdAt,
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return { products, loading, error, refetch: fetchProducts }
}
