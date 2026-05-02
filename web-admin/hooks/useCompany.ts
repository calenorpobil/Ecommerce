'use client'

import { useState, useEffect } from 'react'
import { getReadContract } from './useContract'

export interface Company {
  companyId: bigint
  companyAddress: string
  name: string
  description: string
  taxId: string
  isActive: boolean
  registrationDate: bigint
}

export function useCompany(address: string | null) {
  const [company, setCompany] = useState<Company | null>(null)
  const [companyId, setCompanyId] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      setCompany(null)
      setCompanyId(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const fetch = async () => {
      try {
        const contract = getReadContract()
        const id: bigint = await contract.getCompanyIdByAddress(address)
        if (cancelled) return
        if (id === BigInt(0)) {
          setCompany(null)
          setCompanyId(null)
        } else {
          const data = await contract.getCompany(id)
          if (!cancelled) {
            setCompanyId(id)
            setCompany({
              companyId: data.companyId,
              companyAddress: data.companyAddress,
              name: data.name,
              description: data.description,
              taxId: data.taxId,
              isActive: data.isActive,
              registrationDate: data.registrationDate,
            })
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar empresa')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [address])

  const refetch = () => {
    if (!address) return
    setLoading(true)
    const fetch = async () => {
      try {
        const contract = getReadContract()
        const id: bigint = await contract.getCompanyIdByAddress(address)
        if (id === BigInt(0)) {
          setCompany(null)
          setCompanyId(null)
        } else {
          const data = await contract.getCompany(id)
          setCompanyId(id)
          setCompany({
            companyId: data.companyId,
            companyAddress: data.companyAddress,
            name: data.name,
            description: data.description,
            taxId: data.taxId,
            isActive: data.isActive,
            registrationDate: data.registrationDate,
          })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar empresa')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }

  return { company, companyId, loading, error, refetch }
}
