'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { useWallet } from '@/hooks/useWallet'
import { useProducts } from '@/hooks/useProducts'
import { getReadContract, getWriteContract, getSubContracts } from '@/hooks/useContract'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { formatEURT, parseEURT, formatAddress, formatDate, parseRevertReason } from '@/lib/utils'
import { uploadToIPFS, ipfsToUrl } from '@/services/ipfs'

interface Company {
  companyId: bigint
  companyAddress: string
  name: string
  description: string
  taxId: string
  isActive: boolean
  registrationDate: bigint
}

interface Invoice {
  invoiceId: bigint
  customerAddress: string
  totalAmount: bigint
  timestamp: bigint
  isPaid: boolean
  isRefunded: boolean
  paymentTxHash: string
}

interface Customer {
  customerAddress: string
  totalPurchases: bigint
  totalSpent: bigint
  registrationDate: bigint
  lastPurchaseDate: bigint
  isActive: boolean
}

type Tab = 'products' | 'invoices' | 'customers'

export default function CompanyDetailPage() {
  const params = useParams()
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const companyId = BigInt(rawId ?? '0')
  const { address, isCorrectNetwork } = useWallet()
  const toast = useToast()

  const [company, setCompany] = useState<Company | null>(null)
  const [companyLoading, setCompanyLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('products')

  useEffect(() => {
    setCompanyLoading(true)
    getReadContract().getCompany(companyId).then((c: Company) => {
      setCompany({
        companyId: c.companyId,
        companyAddress: c.companyAddress,
        name: c.name,
        description: c.description,
        taxId: c.taxId,
        isActive: c.isActive,
        registrationDate: c.registrationDate,
      })
    }).catch(() => toast('No se pudo cargar la empresa', 'error'))
      .finally(() => setCompanyLoading(false))
  }, [companyId])

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      {companyLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : company ? (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">{company.name}</h1>
              <Badge variant={company.isActive ? 'success' : 'danger'}>
                {company.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
            <p className="text-zinc-500 text-sm mt-1">{company.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-zinc-600">
              <span>ID #{company.companyId.toString()}</span>
              <span>CIF: {company.taxId}</span>
              <span className="font-mono">{formatAddress(company.companyAddress)}</span>
              <span>Registrada: {formatDate(company.registrationDate)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-zinc-500">Empresa no encontrada</p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {(['products', 'invoices', 'customers'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'products' ? 'Productos' : tab === 'invoices' ? 'Facturas' : 'Clientes'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'products' && (
        <ProductsTab companyId={companyId} address={address} isCorrectNetwork={isCorrectNetwork} />
      )}
      {activeTab === 'invoices' && (
        <InvoicesTab companyId={companyId} address={address} isCorrectNetwork={isCorrectNetwork} />
      )}
      {activeTab === 'customers' && (
        <CustomersTab companyId={companyId} />
      )}
    </div>
  )
}

/* ─── Products Tab ─── */

function ProductsTab({ companyId, address, isCorrectNetwork }: { companyId: bigint; address: string | null; isCorrectNetwork: boolean }) {
  const toast = useToast()
  const { products, loading, refetch } = useProducts(companyId)
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<bigint | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '', ipfsImageHash: '' })
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({})

  const resetForm = () => {
    setForm({ name: '', description: '', price: '', stock: '', ipfsImageHash: '' })
    setEditProduct(null)
    setShowForm(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const hash = await uploadToIPFS(file)
      setForm(f => ({ ...f, ipfsImageHash: hash }))
      toast('Imagen subida a IPFS', 'success')
    } catch (err) {
      toast(parseRevertReason(err), 'error')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return toast('Conecta tu wallet', 'error')
    if (!isCorrectNetwork) return toast('Red incorrecta', 'error')
    setSubmitting(true)
    try {
      const contract = await getWriteContract()
      if (editProduct !== null) {
        const tx = await contract.updateProduct(
          editProduct,
          form.name,
          form.description,
          parseEURT(form.price),
          form.ipfsImageHash
        )
        await tx.wait()
        toast('Producto actualizado', 'success')
      } else {
        const tx = await contract.addProduct(
          companyId,
          form.name,
          form.description,
          parseEURT(form.price),
          BigInt(form.stock),
          form.ipfsImageHash
        )
        await tx.wait()
        toast('Producto añadido', 'success')
      }
      resetForm()
      refetch()
    } catch (e) {
      toast(parseRevertReason(e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (p: (typeof products)[number]) => {
    setForm({
      name: p.name,
      description: p.description,
      price: formatEURT(p.price),
      stock: p.stock.toString(),
      ipfsImageHash: p.ipfsImageHash,
    })
    setEditProduct(p.productId)
    setShowForm(true)
  }

  const handleUpdateStock = async (productId: bigint) => {
    const newStock = stockInputs[productId.toString()]
    if (!newStock) return
    if (!address) return toast('Conecta tu wallet', 'error')
    try {
      const contract = await getWriteContract()
      const tx = await contract.updateStock(productId, BigInt(newStock))
      await tx.wait()
      toast('Stock actualizado', 'success')
      setStockInputs(s => ({ ...s, [productId.toString()]: '' }))
      refetch()
    } catch (e) {
      toast(parseRevertReason(e), 'error')
    }
  }

  const handleDeactivate = async (productId: bigint, name: string) => {
    if (!confirm(`¿Desactivar el producto "${name}"?`)) return
    if (!address) return toast('Conecta tu wallet', 'error')
    try {
      const contract = await getWriteContract()
      const tx = await contract.deactivateProduct(productId)
      await tx.wait()
      toast('Producto desactivado', 'success')
      refetch()
    } catch (e) {
      toast(parseRevertReason(e), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{products.length} producto{products.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm) }}>
          {showForm && editProduct === null ? 'Cancelar' : '+ Añadir producto'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="font-medium text-zinc-100">{editProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <Input label="Precio EURT *" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
            {!editProduct && (
              <Input label="Stock inicial *" type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} required />
            )}
            <Input label="Descripción" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide block">Imagen</label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 text-sm px-3 py-2 rounded-lg transition-colors">
                {uploadingImage ? 'Subiendo…' : 'Subir imagen'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              {form.ipfsImageHash && (
                <span className="text-xs text-green-400 font-mono truncate max-w-[200px]">{form.ipfsImageHash}</span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" loading={submitting}>{editProduct ? 'Guardar cambios' : 'Añadir producto'}</Button>
            <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-600">
          Sin productos. Añade el primero.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.productId.toString()} className={`bg-zinc-900 border rounded-xl overflow-hidden ${p.isActive ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'}`}>
              {p.ipfsImageHash ? (
                <div className="h-40 relative bg-zinc-800">
                  <img
                    src={ipfsToUrl(p.ipfsImageHash)}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              ) : (
                <div className="h-40 bg-zinc-800 flex items-center justify-center text-zinc-600 text-sm">Sin imagen</div>
              )}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-100 text-sm">{p.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{p.description}</p>
                  </div>
                  <Badge variant={p.isActive ? 'success' : 'danger'} className="shrink-0">
                    {p.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-indigo-400">{formatEURT(p.price)} EURT</span>
                  <span className="text-zinc-400">Stock: <strong className="text-zinc-200">{p.stock.toString()}</strong></span>
                </div>

                {/* Stock update */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Nuevo stock"
                    value={stockInputs[p.productId.toString()] ?? ''}
                    onChange={e => setStockInputs(s => ({ ...s, [p.productId.toString()]: e.target.value }))}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Button size="sm" variant="secondary" onClick={() => handleUpdateStock(p.productId)}>
                    Stock
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => handleEdit(p)}>Editar</Button>
                  {p.isActive && (
                    <Button size="sm" variant="danger" className="flex-1" onClick={() => handleDeactivate(p.productId, p.name)}>Desactivar</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Invoices Tab ─── */

function InvoicesTab({ companyId, address, isCorrectNetwork }: { companyId: bigint; address: string | null; isCorrectNetwork: boolean }) {
  const toast = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'refunded'>('all')
  const [expandedId, setExpandedId] = useState<bigint | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<Record<string, { productName: string; quantity: bigint; unitPrice: bigint; totalPrice: bigint }[]>>({})
  const [refunding, setRefunding] = useState<bigint | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { invoiceSystem } = await getSubContracts()
      const contract = getReadContract()
      const ids: bigint[] = await invoiceSystem.getCompanyInvoices(companyId)
      const data = await Promise.all(ids.map((id: bigint) => contract.getInvoice(id)))
      setInvoices(data.map((inv: Invoice) => ({
        invoiceId: inv.invoiceId,
        customerAddress: inv.customerAddress,
        totalAmount: inv.totalAmount,
        timestamp: inv.timestamp,
        isPaid: inv.isPaid,
        isRefunded: inv.isRefunded,
        paymentTxHash: inv.paymentTxHash,
      })).reverse())
    } catch (e) {
      toast('Error al cargar facturas', 'error')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { load() }, [load])

  const loadItems = async (invoiceId: bigint) => {
    const key = invoiceId.toString()
    if (invoiceItems[key]) return
    try {
      const contract = getReadContract()
      const items = await contract.getInvoiceItems(invoiceId)
      setInvoiceItems(prev => ({
        ...prev,
        [key]: items.map((item: { productName: string; quantity: bigint; unitPrice: bigint; totalPrice: bigint }) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      }))
    } catch {
      // ignore
    }
  }

  const toggleExpand = (id: bigint) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      loadItems(id)
    }
  }

  const handleRefund = async (invoiceId: bigint) => {
    if (!confirm(`¿Reembolsar la factura #${invoiceId}? Se devolverán los tokens al cliente.`)) return
    if (!address) return toast('Conecta tu wallet', 'error')
    if (!isCorrectNetwork) return toast('Red incorrecta', 'error')
    setRefunding(invoiceId)
    try {
      const contract = await getWriteContract()
      const tx = await contract.refund(invoiceId)
      await tx.wait()
      toast(`Factura #${invoiceId} reembolsada`, 'success')
      load()
    } catch (e) {
      toast(parseRevertReason(e), 'error')
    } finally {
      setRefunding(null)
    }
  }

  const filtered = invoices.filter(inv => {
    if (filter === 'paid') return inv.isPaid && !inv.isRefunded
    if (filter === 'pending') return !inv.isPaid && !inv.isRefunded
    if (filter === 'refunded') return inv.isRefunded
    return true
  })

  const invoiceStatus = (inv: Invoice) => {
    if (inv.isRefunded) return <Badge variant="warning">Reembolsada</Badge>
    if (inv.isPaid) return <Badge variant="success">Pagada</Badge>
    return <Badge variant="default">Pendiente</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'paid', 'pending', 'refunded'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              filter === f ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'paid' ? 'Pagadas' : f === 'pending' ? 'Pendientes' : 'Reembolsadas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse bg-zinc-800 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-600">
          Sin facturas en esta categoría
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {filtered.map((inv, idx) => (
            <div key={inv.invoiceId.toString()} className={idx !== filtered.length - 1 ? 'border-b border-zinc-800' : ''}>
              <div
                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                onClick={() => toggleExpand(inv.invoiceId)}
              >
                <div className="flex items-center gap-4">
                  <span className="text-zinc-500 font-mono text-sm">#{inv.invoiceId.toString()}</span>
                  <span className="text-zinc-300 text-sm font-mono">{formatAddress(inv.customerAddress)}</span>
                  <span className="text-indigo-400 font-semibold text-sm">{formatEURT(inv.totalAmount)} EURT</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 text-xs hidden sm:inline">{formatDate(inv.timestamp)}</span>
                  {invoiceStatus(inv)}
                  <span className="text-zinc-600 text-xs">{expandedId === inv.invoiceId ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedId === inv.invoiceId && (
                <div className="px-4 pb-4 pt-1 bg-zinc-800/20 space-y-3">
                  {/* Items */}
                  <div>
                    <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Artículos</p>
                    {invoiceItems[inv.invoiceId.toString()] ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-zinc-600">
                            <th className="py-1 font-normal">Producto</th>
                            <th className="py-1 font-normal text-right">Cant.</th>
                            <th className="py-1 font-normal text-right">P. Unit.</th>
                            <th className="py-1 font-normal text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceItems[inv.invoiceId.toString()].map((item, i) => (
                            <tr key={i} className="text-zinc-300">
                              <td className="py-1">{item.productName}</td>
                              <td className="py-1 text-right">{item.quantity.toString()}</td>
                              <td className="py-1 text-right">{formatEURT(item.unitPrice)} EURT</td>
                              <td className="py-1 text-right font-medium">{formatEURT(item.totalPrice)} EURT</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="h-8 animate-pulse bg-zinc-800 rounded" />
                    )}
                  </div>

                  {/* TX Hash */}
                  {inv.paymentTxHash && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Tx Hash</p>
                      <p className="font-mono text-xs text-zinc-400 break-all">{inv.paymentTxHash}</p>
                    </div>
                  )}

                  {/* Refund button */}
                  {inv.isPaid && !inv.isRefunded && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={refunding === inv.invoiceId}
                      onClick={() => handleRefund(inv.invoiceId)}
                    >
                      Reembolsar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Customers Tab ─── */

function CustomersTab({ companyId }: { companyId: bigint }) {
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { invoiceSystem } = await getSubContracts()
        const contract = getReadContract()
        const invoiceIds: bigint[] = await invoiceSystem.getCompanyInvoices(companyId)
        const invoices = await Promise.all(invoiceIds.map((id: bigint) => contract.getInvoice(id)))

        const seen = new Set<string>()
        const addresses: string[] = []
        for (const inv of invoices) {
          const addr: string = inv.customerAddress
          if (!seen.has(addr)) {
            seen.add(addr)
            addresses.push(addr)
          }
        }

        if (cancelled) return
        const customerData = await Promise.all(
          addresses.map((addr: string) => contract.getCustomer(addr))
        )
        if (!cancelled) {
          setCustomers(
            customerData.map((c: Customer) => ({
              customerAddress: c.customerAddress,
              totalPurchases: c.totalPurchases,
              totalSpent: c.totalSpent,
              registrationDate: c.registrationDate,
              lastPurchaseDate: c.lastPurchaseDate,
              isActive: c.isActive,
            }))
          )
        }
      } catch (e) {
        if (!cancelled) toast('Error al cargar clientes', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [companyId])

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">{customers.length} cliente{customers.length !== 1 ? 's' : ''} únicos</p>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 animate-pulse bg-zinc-800 rounded-lg" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-600">
          Sin clientes todavía
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Wallet</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide text-right">Compras</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide text-right">Total gastado</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Última compra</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.customerAddress} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-zinc-300">{formatAddress(c.customerAddress)}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{c.totalPurchases.toString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-indigo-400">{formatEURT(c.totalSpent)} EURT</td>
                  <td className="px-4 py-3 hidden md:table-cell text-zinc-500 text-xs">
                    {c.lastPurchaseDate > BigInt(0) ? formatDate(c.lastPurchaseDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.isActive ? 'success' : 'danger'}>
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
