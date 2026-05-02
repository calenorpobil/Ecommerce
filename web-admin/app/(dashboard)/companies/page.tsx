'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { getReadContract, getWriteContract, getSubContracts } from '@/hooks/useContract'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { formatAddress, formatDate, parseRevertReason } from '@/lib/utils'

interface Company {
  companyId: bigint
  companyAddress: string
  name: string
  description: string
  taxId: string
  isActive: boolean
  registrationDate: bigint
}

export default function CompaniesPage() {
  const { address, isCorrectNetwork } = useWallet()
  const toast = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ companyAddress: '', name: '', description: '', taxId: '' })

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const { companyRegistry } = await getSubContracts()
      const contract = getReadContract()
      const ids: bigint[] = await companyRegistry.getAllCompanyIds()
      const data = await Promise.all(ids.map((id: bigint) => contract.getCompany(id)))
      setCompanies(data.map(c => ({
        companyId: c.companyId,
        companyAddress: c.companyAddress,
        name: c.name,
        description: c.description,
        taxId: c.taxId,
        isActive: c.isActive,
        registrationDate: c.registrationDate,
      })))
    } catch (e) {
      toast('Error al cargar empresas: ' + parseRevertReason(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCompanies() }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return toast('Conecta tu wallet primero', 'error')
    if (!isCorrectNetwork) return toast('Red incorrecta. Cambia a la red local (31337)', 'error')

    setSubmitting(true)
    try {
      const contract = await getWriteContract()
      const tx = await contract.registerCompany(
        form.companyAddress || address,
        form.name,
        form.description,
        form.taxId
      )
      toast('Transacción enviada, esperando confirmación…', 'info')
      await tx.wait()
      toast(`Empresa "${form.name}" registrada con éxito`, 'success')
      setForm({ companyAddress: '', name: '', description: '', taxId: '' })
      setShowForm(false)
      loadCompanies()
    } catch (e) {
      toast(parseRevertReason(e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (companyId: bigint, name: string) => {
    if (!confirm(`¿Desactivar la empresa "${name}"? Esta acción es irreversible.`)) return
    if (!address) return toast('Conecta tu wallet primero', 'error')
    try {
      const contract = await getWriteContract()
      const tx = await contract.deactivateCompany(companyId)
      toast('Desactivando empresa…', 'info')
      await tx.wait()
      toast(`Empresa "${name}" desactivada`, 'success')
      loadCompanies()
    } catch (e) {
      toast(parseRevertReason(e), 'error')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Empresas</h1>
          <p className="text-zinc-500 text-sm mt-1">{companies.length} empresa{companies.length !== 1 ? 's' : ''} registrada{companies.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Registrar empresa'}
        </Button>
      </div>

      {/* Register form */}
      {showForm && (
        <form onSubmit={handleRegister} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-zinc-100">Nueva empresa</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Wallet de la empresa"
              placeholder={address ?? '0x...'}
              value={form.companyAddress}
              onChange={e => setForm(f => ({ ...f, companyAddress: e.target.value }))}
            />
            <Input
              label="Nombre *"
              placeholder="Ej: Tienda ABC"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              label="CIF / Tax ID *"
              placeholder="Ej: B12345678"
              value={form.taxId}
              onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))}
              required
            />
            <Input
              label="Descripción"
              placeholder="Descripción de la empresa"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Si no indicas wallet, se usará tu dirección conectada ({address ? formatAddress(address) : '—'})
          </p>
          <div className="flex gap-3">
            <Button type="submit" loading={submitting} disabled={!address}>
              Registrar on-chain
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Companies table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">ID</th>
              <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Nombre</th>
              <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden sm:table-cell">Wallet</th>
              <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Tax ID</th>
              <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden lg:table-cell">Registrada</th>
              <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  <td colSpan={7} className="px-4 py-3">
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-600">
                  No hay empresas registradas
                </td>
              </tr>
            ) : (
              companies.map(c => (
                <tr key={c.companyId.toString()} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-500 font-mono">#{c.companyId.toString()}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/company/${c.companyId.toString()}`}
                      className="font-medium text-zinc-100 hover:text-indigo-400 transition-colors"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-zinc-600 mt-0.5 truncate max-w-[200px]">{c.description}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="font-mono text-xs text-zinc-400">{formatAddress(c.companyAddress)}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-zinc-400">{c.taxId}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-zinc-500 text-xs">{formatDate(c.registrationDate)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.isActive ? 'success' : 'danger'}>
                      {c.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/company/${c.companyId.toString()}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        Gestionar
                      </Link>
                      {c.isActive && (
                        <button
                          onClick={() => handleDeactivate(c.companyId, c.name)}
                          className="text-xs text-red-500 hover:text-red-400"
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
