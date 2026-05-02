"use client";

import { useState, useCallback } from "react";
import { BrowserProvider } from "ethers";
import MetaMaskConnect from "./components/MetaMaskConnect";
import EurtBalance from "./components/EurtBalance";
import PurchaseForm from "./components/PurchaseForm";

type Step = "connect" | "purchase" | "success";

export default function Home() {
  const [step, setStep] = useState<Step>("connect");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [balanceKey, setBalanceKey] = useState(0);

  const handleConnect = useCallback(
    (address: string, prov: BrowserProvider) => {
      setWalletAddress(address);
      setProvider(prov);
      setStep("purchase");
    },
    []
  );

  const handlePurchaseSuccess = () => {
    setBalanceKey((k) => k + 1);
    setStep("success");
  };

  const handleBuyMore = () => {
    setStep("purchase");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">
            Comprar EuroTokens
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Convierte euros en EURT al instante
          </p>
        </div>

        {/* Balance (solo cuando hay wallet conectada) */}
        {walletAddress && provider && (
          <EurtBalance key={balanceKey} address={walletAddress} />
        )}

        {/* Paso 1: Conectar wallet */}
        {step === "connect" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-gray-600 text-sm text-center">
              Conecta tu wallet de MetaMask para comenzar a comprar EuroTokens.
            </p>
            <MetaMaskConnect onConnect={handleConnect} />
          </div>
        )}

        {/* Paso 2: Formulario de compra */}
        {step === "purchase" && walletAddress && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Comprar EURT</h2>
              <MetaMaskConnect onConnect={handleConnect} />
            </div>
            <PurchaseForm
              walletAddress={walletAddress}
              onPurchaseSuccess={handlePurchaseSuccess}
            />
          </div>
        )}

        {/* Paso 3: Éxito */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-bold text-green-700">¡Pago recibido!</h2>
            <p className="text-gray-500 text-sm text-center">
              Tus tokens EURT han sido acreditados a tu wallet.
            </p>
            <button
              onClick={handleBuyMore}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Comprar más tokens
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
