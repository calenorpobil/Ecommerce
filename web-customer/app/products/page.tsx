'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useAllProducts, type Product, type Company } from '@/hooks/useProducts'
import { useCart } from '@/hooks/useCart'
import { useWallet } from '@/hooks/useWallet'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { formatEURT, ipfsToHttp } from '@/lib/utils'

export default function ProductsPage() {
  const { products, companies, loading, error } = useAllProducts()
  const { address, connect } = useWallet()
  const { addToCart, actionLoading, error: cartError } = useCart(address)
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [addingId, setAddingId] = useState<string | null>(null)

  const companiesList = useMemo(() => [...companies.values()], [companies])

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
      const matchCompany = selectedCompany === 'all' || p.companyId.toString() === selectedCompany
      return matchSearch && matchCompany
    })
  }, [products, search, selectedCompany])

  async function handleAddToCart(product: Product) {
    if (!address) {
      await connect()
      return
    }
    setAddingId(product.productId.toString())
    const ok = await addToCart(product.productId, BigInt(1))
    if (ok) {
      toast(`"${product.name}" añadido al carrito`, 'success')
    } else if (cartError) {
      toast(cartError, 'error')
    }
    setAddingId(null)
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/30 p-6 text-center text-red-400">
        Error al cargar productos: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar productos…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
        <select
          value={selectedCompany}
          onChange={e => setSelectedCompany(e.target.value)}
          className="rounded-lg border border-surface-border bg-surface-card px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <option value="all">Todas las empresas</option>
          {companiesList.map(c => (
            <option key={c.companyId.toString()} value={c.companyId.toString()}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <ProductSkeleton />
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-zinc-500">
          {search || selectedCompany !== 'all'
            ? 'No se encontraron productos con esos filtros'
            : 'No hay productos disponibles'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(product => (
            <ProductCard
              key={product.productId.toString()}
              product={product}
              company={companies.get(product.companyId.toString())}
              isAdding={addingId === product.productId.toString()}
              onAddToCart={() => handleAddToCart(product)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductCard({
  product,
  company,
  isAdding,
  onAddToCart,
}: {
  product: Product
  company: Company | undefined
  isAdding: boolean
  onAddToCart: () => void
}) {
  const imgSrc = ipfsToHttp(product.ipfsImageHash)

  return (
    <div className="flex flex-col rounded-xl border border-surface-border bg-surface-card overflow-hidden hover:border-zinc-600 transition-colors">
      <div className="relative h-44 bg-zinc-900">
        <Image
          src={imgSrc}
          alt={product.name}
          fill
          className="object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png' }}
          unoptimized={imgSrc.startsWith('https://gateway.pinata.cloud')}
        />
      </div>
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1 space-y-1">
          <h3 className="font-semibold text-zinc-100 line-clamp-1">{product.name}</h3>
          {company && (
            <p className="text-xs text-zinc-500">{company.name}</p>
          )}
          <p className="text-xs text-zinc-400 line-clamp-2">{product.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-indigo-400">{formatEURT(product.price)} EURT</p>
            <Badge variant={Number(product.stock) > 5 ? 'green' : 'yellow'} className="mt-0.5">
              Stock: {product.stock.toString()}
            </Badge>
          </div>
          <Button size="sm" onClick={onAddToCart} loading={isAdding}>
            + Carrito
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
          <Skeleton className="h-44 w-full rounded-none" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
