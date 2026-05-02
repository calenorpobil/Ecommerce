"use client";

import { useState, useEffect } from "react";
import { JsonRpcProvider, Contract, formatUnits } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
];

interface EurtBalanceProps {
  address: string;
}

export default function EurtBalance({ address }: EurtBalanceProps) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const contractAddress = process.env.NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

  useEffect(() => {
    const fetchBalance = async () => {
      if (!contractAddress || !rpcUrl) {
        setBalance("N/A");
        setLoading(false);
        return;
      }
      try {
        // JsonRpcProvider directo a Anvil, sin pasar por la caché de MetaMask
        const provider = new JsonRpcProvider(rpcUrl);
        const contract = new Contract(contractAddress, ERC20_ABI, provider);
        const raw = await contract.balanceOf(address);
        setBalance(formatUnits(raw, 6));
      } catch (err) {
        console.error("EurtBalance error:", err);
        setBalance("Error");
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, [address, contractAddress, rpcUrl]);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
      <p className="text-xs text-blue-500 uppercase font-semibold tracking-wide">
        Balance EURT
      </p>
      <p className="text-2xl font-bold text-blue-700">
        {loading ? "..." : balance} <span className="text-lg">€</span>
      </p>
    </div>
  );
}
