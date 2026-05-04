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

export interface Company {
  companyId: bigint
  companyAddress: string
  name: string
  description: string
  taxId: string
  isActive: boolean
  registrationDate: bigint
}

function mapProduct(p: {
  productId: bigint
  companyId: bigint
  name: string
  description: string
  price: bigint
  stock: bigint
  ipfsImageHash: string
  isActive: boolean
  createdAt: bigint
}): Product {
  return {
    productId: p.productId,
    companyId: p.companyId,
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    ipfsImageHash: p.ipfsImageHash,
    isActive: p.isActive,
    createdAt: p.createdAt,
  }
}

export function useAllProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [companies, setCompanies] = useState<Map<string, Company>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const contract = getReadContract()
      const companyIds: bigint[] = await contract.getAllCompanyIds()

      const companiesData = await Promise.all(companyIds.map(id => contract.getCompany(id)))
      const activeCompanies = companiesData.filter((c) => c.isActive)

      const companyMap = new Map<string, Company>()
      for (const c of activeCompanies) {
        companyMap.set(c.companyId.toString(), {
          companyId: c.companyId,
          companyAddress: c.companyAddress,
          name: c.name,
          description: c.description,
          taxId: c.taxId,
          isActive: c.isActive,
          registrationDate: c.registrationDate,
        })
      }

      const productArrays = await Promise.all(
        activeCompanies.map(c => contract.getProductsByCompany(c.companyId))
      )
      const allProductIds = productArrays.flat() as bigint[]

      const productData = await Promise.all(allProductIds.map(id => contract.getProduct(id)))
      const activeProducts = productData
        .filter(p => p.isActive && p.stock > BigInt(0))
        .map(mapProduct)

      setCompanies(companyMap)
      setProducts(activeProducts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { products, companies, loading, error, refetch: fetchAll }
}
