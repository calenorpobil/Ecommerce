'use client'

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { REQUIRED_CHAIN_ID } from '@/lib/addresses'

interface WalletState {
  address: string | null
  chainId: number | null
  isConnecting: boolean
  isCorrectNetwork: boolean
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnecting: false,
    isCorrectNetwork: false,
  })

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask no está instalado')
      return
    }
    setState(prev => ({ ...prev, isConnecting: true }))
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)
      setState({ address, chainId, isConnecting: false, isCorrectNetwork: chainId === REQUIRED_CHAIN_ID })
    } catch {
      setState(prev => ({ ...prev, isConnecting: false }))
    }
  }, [])

  const disconnect = useCallback(() => {
    setState({ address: null, chainId: null, isConnecting: false, isCorrectNetwork: false })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }))
      }
    }

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16)
      setState(prev => ({ ...prev, chainId, isCorrectNetwork: chainId === REQUIRED_CHAIN_ID }))
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts.length > 0) connect()
    })

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener('chainChanged', handleChainChanged)
    }
  }, [connect, disconnect])

  return { ...state, connect, disconnect }
}
