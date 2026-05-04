'use client'

import { ethers } from 'ethers'
import { ECOMMERCE_MAIN_ABI, EURO_TOKEN_ABI } from '@/lib/abi'
import { ECOMMERCE_MAIN_ADDRESS, EURO_TOKEN_ADDRESS, RPC_URL } from '@/lib/addresses'

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

export async function getEuroTokenWriteContract() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask no está disponible')
  }
  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()
  return new ethers.Contract(EURO_TOKEN_ADDRESS, EURO_TOKEN_ABI, signer)
}

export function getEuroTokenReadContract() {
  return new ethers.Contract(EURO_TOKEN_ADDRESS, EURO_TOKEN_ABI, getProvider())
}
