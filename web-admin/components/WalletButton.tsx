'use client'

import { useWallet } from '@/hooks/useWallet'
import { Button } from './ui/Button'
import { formatAddress } from '@/lib/utils'
import { REQUIRED_CHAIN_ID } from '@/lib/addresses'

export function WalletButton() {
  const { address, chainId, isConnecting, isCorrectNetwork, connect, disconnect } = useWallet()

  if (!address) {
    return (
      <Button onClick={connect} loading={isConnecting} size="sm">
        Conectar Wallet
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {!isCorrectNetwork && (
        <span className="text-xs text-red-400 bg-red-900/30 border border-red-800 px-2 py-1 rounded-lg">
          Red incorrecta (necesita chain {REQUIRED_CHAIN_ID})
        </span>
      )}
      <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5">
        <span className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-sm text-zinc-300 font-mono">{formatAddress(address)}</span>
        <button
          onClick={disconnect}
          className="text-zinc-500 hover:text-zinc-300 text-xs ml-1"
          title="Desconectar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
