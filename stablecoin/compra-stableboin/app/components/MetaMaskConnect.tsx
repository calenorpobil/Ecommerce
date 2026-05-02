"use client";

import { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";

interface MetaMaskConnectProps {
  onConnect: (address: string, provider: BrowserProvider) => void;
}

export default function MetaMaskConnect({ onConnect }: MetaMaskConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Reconectar automáticamente si ya hay una cuenta autorizada
    const tryAutoConnect = async () => {
      if (typeof window === "undefined" || !window.ethereum) return;
      const accounts: string[] = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts.length > 0) {
        const provider = new BrowserProvider(window.ethereum);
        setAddress(accounts[0]);
        onConnect(accounts[0], provider);
      }
    };
    tryAutoConnect();
  }, [onConnect]);

  const connect = async () => {
    setError(null);
    setLoading(true);
    try {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask no está instalado");
      }
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
      onConnect(accounts[0], provider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al conectar";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const shortAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="flex flex-col items-center gap-2">
      {address ? (
        <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          {shortAddress(address)}
        </div>
      ) : (
        <button
          onClick={connect}
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
        >
          {loading ? "Conectando..." : "Conectar MetaMask"}
        </button>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
