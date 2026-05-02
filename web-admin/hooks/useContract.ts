'use client'

import { ethers } from 'ethers'
import {
  ECOMMERCE_MAIN_ABI,
  COMPANY_REGISTRY_ABI,
  INVOICE_SYSTEM_ABI,
  CUSTOMER_REGISTRY_ABI,
} from '@/lib/abi'
import { ECOMMERCE_MAIN_ADDRESS, RPC_URL } from '@/lib/addresses'

export function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL)
}

export function getReadContract() {
  return new ethers.Contract(ECOMMERCE_MAIN_ADDRESS, ECOMMERCE_MAIN_ABI, getProvider())
}

export async function getWriteContract() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask no está disponible')
  }
  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return new ethers.Contract(ECOMMERCE_MAIN_ADDRESS, ECOMMERCE_MAIN_ABI, signer)
}

export async function getSubContracts() {
  const main = getReadContract()
  const provider = getProvider()
  const [companyRegistryAddr, invoiceSystemAddr, customerRegistryAddr] = await Promise.all([
    main.companyRegistry(),
    main.invoiceSystem(),
    main.customerRegistry(),
  ])
  return {
    companyRegistry: new ethers.Contract(companyRegistryAddr, COMPANY_REGISTRY_ABI, provider),
    invoiceSystem: new ethers.Contract(invoiceSystemAddr, INVOICE_SYSTEM_ABI, provider),
    customerRegistry: new ethers.Contract(customerRegistryAddr, CUSTOMER_REGISTRY_ABI, provider),
  }
}
