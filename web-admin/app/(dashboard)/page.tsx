'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { useCompany } from '@/hooks/useCompany'
import { getSubContracts, getReadContract } from '@/hooks/useContract'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { formatEURT, formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const { address } = useWallet()
  const { company, companyId, loading: companyLoading } = useCompany(address)
  const [totalCompanies, setTotalCompanies] = useState<number | null>(null)
  const [recentInvoices, setRecentInvoices] = useState<{id: bigint; total: bigint; isPaid: boolean; timestamp: bigint}[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  useEffect(() => {
    getSubContracts().then(({ companyRegistry }) => {
      companyRegistry.getAllCompanyIds().then((ids: bigint[]) => setTotalCompanies(ids.length))
    }).catch(() => setTotalCompanies(0))
  }, [])

  useEffect(() => {
    if (!companyId) return
    setInvoicesLoading(true)
    const load = async () => {
      try {
        const { invoiceSystem } = await getSubContracts()
        const contract = getReadContract()
        const ids: bigint[] = await invoiceSystem.getCompanyInvoices(companyId)
        const recent = ids.slice(-5).reverse()
        const data = await Promise.all(recent.map(id => contract.getInvoice(id)))
        setRecentInvoices(data.map(inv => ({
          id: inv.invoiceId,
          total: inv.totalAmount,
          isPaid: inv.isPaid,
          timestamp: inv.timestamp,
        })))
      } catch {
        // ignore
      } finally {
        setInvoicesLoading(false)
      }
    }
    load()
  }, [companyId])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Visión general del panel de administración</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Empresas registradas</p>
          <p className="text-3xl font-bold text-indigo-400 mt-1">
            {totalCompanies === null ? '—' : totalCompanies}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Tu empresa</p>
          {companyLoading ? (
            <div className="h-8 w-24 animate-pulse bg-zinc-800 rounded mt-1" />
          ) : company ? (
            <p className="text-lg font-semibold text-zinc-100 mt-1 truncate">{company.name}</p>
          ) : (
            <p className="text-sm text-zinc-600 mt-1">No registrada</p>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Estado empresa</p>
          <div className="mt-2">
            {company ? (
              <Badge variant={company.isActive ? 'success' : 'danger'}>
                {company.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
            ) : (
              <Badge variant="default">Sin empresa</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Company panel */}
      {!address && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400">Conecta tu wallet para ver tu empresa</p>
        </div>
      )}

      {address && !companyLoading && !company && (
        <div className="bg-indigo-950/50 border border-indigo-800 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="font-medium text-indigo-200">Tu wallet no tiene empresa registrada</p>
            <p className="text-sm text-indigo-400 mt-1">Registra una empresa para empezar a vender</p>
          </div>
          <Link
            href="/companies"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Registrar empresa →
          </Link>
        </div>
      )}

      {company && companyId && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-zinc-100">Tu empresa</h2>
            <Link
              href={`/company/${companyId.toString()}`}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Gestionar →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-zinc-500">Nombre</p>
              <p className="text-zinc-100 font-medium">{company.name}</p>
            </div>
            <div>
              <p className="text-zinc-500">CIF / Tax ID</p>
              <p className="text-zinc-100 font-medium">{company.taxId}</p>
            </div>
            <div>
              <p className="text-zinc-500">Registrada</p>
              <p className="text-zinc-100">{formatDate(company.registrationDate)}</p>
            </div>
            <div>
              <p className="text-zinc-500">ID on-chain</p>
              <p className="text-zinc-100 font-mono">#{companyId.toString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent invoices */}
      {companyId && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="font-semibold text-zinc-100 mb-4">Últimas facturas</h2>
          {invoicesLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse bg-zinc-800 rounded" />)}
            </div>
          ) : recentInvoices.length === 0 ? (
            <p className="text-sm text-zinc-600">Sin facturas todavía</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {recentInvoices.map(inv => (
                <div key={inv.id.toString()} className="py-2.5 flex items-center justify-between">
                  <span className="text-zinc-400 font-mono text-sm">#{inv.id.toString()}</span>
                  <span className="text-zinc-300 text-sm">{formatEURT(inv.total)} EURT</span>
                  <span className="text-zinc-500 text-xs">{formatDate(inv.timestamp)}</span>
                  <Badge variant={inv.isPaid ? 'success' : 'warning'}>
                    {inv.isPaid ? 'Pagada' : 'Pendiente'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {companyId && (
            <Link
              href={`/company/${companyId.toString()}`}
              className="text-sm text-indigo-400 hover:text-indigo-300 mt-3 inline-block"
            >
              Ver todas →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
