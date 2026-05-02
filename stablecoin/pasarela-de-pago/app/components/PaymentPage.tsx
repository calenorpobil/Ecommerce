"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers";
import { EUROTOKEN_ABI, ECOMMERCE_ABI } from "../lib/contracts";

type Status =
  | "idle"
  | "connecting"
  | "connected"
  | "approving"
  | "processing"
  | "confirming"
  | "success";

const CHAIN_ID = 31337;

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export default function PaymentPage() {
  const params = useSearchParams();
  const merchantAddress = params.get("merchant_address") ?? "";
  const amountStr = params.get("amount") ?? "";
  const invoiceParam = params.get("invoice") ?? "";
  const dateParam = params.get("date") ?? "";
  const redirectParam = params.get("redirect") ?? "";

  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [txHash, setTxHash] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const euroTokenAddr = process.env.NEXT_PUBLIC_EUROTOKEN_ADDRESS ?? "";
  const ecommerceAddr = process.env.NEXT_PUBLIC_ECOMMERCE_ADDRESS ?? "";
  const paymentGatewayAddr = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_ADDRESS ?? "";

  let amountUnits: bigint;
  try {
    amountUnits = amountStr ? parseUnits(amountStr, 6) : 0n;
  } catch {
    amountUnits = 0n;
  }

  const paramsValid =
    !!merchantAddress && !!amountStr && !!invoiceParam && amountUnits > 0n;
  const hasSufficientBalance =
    balance !== null && amountUnits > 0n && balance >= amountUnits;
  const isPaying =
    status === "approving" ||
    status === "processing" ||
    status === "confirming";

  const fetchBalance = useCallback(
    async (addr: string) => {
      if (!window.ethereum || !euroTokenAddr) return;
      const provider = new BrowserProvider(window.ethereum);
      const token = new Contract(euroTokenAddr, EUROTOKEN_ABI, provider);
      const bal: bigint = await token.balanceOf(addr);
      setBalance(bal);
    },
    [euroTokenAddr]
  );

  const connectWallet = async () => {
    if (!window.ethereum) {
      setErrorMsg("MetaMask no está instalado. Instálalo desde metamask.io");
      return;
    }
    setStatus("connecting");
    setErrorMsg("");
    try {
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        setErrorMsg(
          `Red incorrecta. Conecta MetaMask a la red local (chainId: ${CHAIN_ID})`
        );
        setStatus("idle");
        return;
      }
      const accounts = (await provider.send(
        "eth_requestAccounts",
        []
      )) as string[];
      setAccount(accounts[0]);
      await fetchBalance(accounts[0]);
      setStatus("connected");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
        setErrorMsg("Conexión rechazada");
      } else {
        setErrorMsg("No se pudo conectar MetaMask");
      }
      setStatus("idle");
    }
  };

  const pay = async () => {
    if (!window.ethereum || !account || !euroTokenAddr || !ecommerceAddr || !paymentGatewayAddr)
      return;
    setErrorMsg("");

    try {
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        setErrorMsg(
          `Red incorrecta. Conecta MetaMask a la red local (chainId: ${CHAIN_ID})`
        );
        return;
      }
      const signer = await provider.getSigner();
      const token = new Contract(euroTokenAddr, EUROTOKEN_ABI, signer);

      // El approve debe ir al PaymentGateway, que es quien ejecuta el transferFrom
      const allowance: bigint = await token.allowance(account, paymentGatewayAddr);
      if (allowance < amountUnits) {
        setStatus("approving");
        const approveTx = await token.approve(paymentGatewayAddr, amountUnits);
        await approveTx.wait(1);
      }

      // Llamar a EcommerceMain.processPayment(invoiceId) — recupera customer/amount del invoice on-chain
      setStatus("processing");
      const ecommerce = new Contract(ecommerceAddr, ECOMMERCE_ABI, signer);
      let invoiceId: bigint;
      try {
        invoiceId = BigInt(invoiceParam);
      } catch {
        invoiceId = 0n;
      }
      const payTx = await ecommerce.processPayment(invoiceId);

      setStatus("confirming");
      const receipt = await payTx.wait(1);
      const hash: string = receipt.hash;
      setTxHash(hash);
      setStatus("success");

      if (redirectParam) {
        setTimeout(() => {
          try {
            const url = new URL(redirectParam);
            url.searchParams.set("status", "success");
            url.searchParams.set("txHash", hash);
            window.location.href = url.toString();
          } catch {
            window.location.href = `${redirectParam}?status=success&txHash=${hash}`;
          }
        }, 3000);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
        setErrorMsg("Transacción rechazada en MetaMask. Puedes reintentar.");
      } else if (
        msg.includes("insufficient funds") ||
        msg.includes("ERC20InsufficientBalance")
      ) {
        setErrorMsg("Saldo insuficiente de EURT.");
      } else if (msg.includes("ERC20InsufficientAllowance")) {
        setErrorMsg("Allowance insuficiente. Pulsa Pagar de nuevo.");
      } else {
        setErrorMsg(msg.length > 150 ? msg.slice(0, 150) + "…" : msg);
      }
      setStatus("connected");
    }
  };

  // Parámetros inválidos
  if (!paramsValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Parámetros inválidos
          </h1>
          <p className="text-gray-500 text-sm">
            Se requieren <code>merchant_address</code>, <code>amount</code> e{" "}
            <code>invoice</code> en la URL.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        {/* Cabecera */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Pago con EuroTokens
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Red local Anvil · chainId {CHAIN_ID}
          </p>
        </div>

        {/* Detalle del pago */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Comerciante</span>
            <span className="font-mono text-gray-800" title={merchantAddress}>
              {shortAddr(merchantAddress)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Monto</span>
            <span className="font-bold text-lg text-gray-900">
              {amountStr} EURT
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Factura</span>
            <span className="text-gray-800">{invoiceParam}</span>
          </div>
          {dateParam && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Fecha</span>
              <span className="text-gray-800">{dateParam}</span>
            </div>
          )}
        </div>

        {/* Contenido principal */}
        {status === "success" ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-5xl mb-3">✓</div>
              <p className="font-bold text-green-800 text-lg">
                ¡Pago realizado!
              </p>
              <p className="text-green-700 text-xs mt-2 font-mono break-all">
                {txHash}
              </p>
            </div>
            {redirectParam && (
              <p className="text-center text-gray-400 text-sm">
                Redirigiendo en 3 segundos…
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Paso 1: conectar wallet */}
            {(status === "idle" || status === "connecting") && (
              <button
                onClick={connectWallet}
                disabled={status === "connecting"}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl py-3 font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {status === "connecting" ? "Conectando…" : "Conectar MetaMask"}
              </button>
            )}

            {/* Paso 2: wallet conectada */}
            {(status === "connected" || isPaying) && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center text-sm">
                  <span className="text-green-700">Conectado</span>
                  <span className="font-mono text-green-900">
                    {shortAddr(account)}
                  </span>
                </div>

                {balance !== null && (
                  <div
                    className={`rounded-xl p-3 flex justify-between items-center text-sm border ${
                      hasSufficientBalance
                        ? "bg-blue-50 border-blue-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <span
                      className={
                        hasSufficientBalance ? "text-blue-700" : "text-red-700"
                      }
                    >
                      Tu saldo EURT
                    </span>
                    <span
                      className={`font-semibold ${
                        hasSufficientBalance ? "text-blue-900" : "text-red-900"
                      }`}
                    >
                      {formatUnits(balance, 6)} EURT
                    </span>
                  </div>
                )}

                {!hasSufficientBalance && balance !== null ? (
                  <div className="text-center space-y-3">
                    <p className="text-red-600 text-sm">
                      Saldo insuficiente para este pago.
                    </p>
                    <a
                      href="http://localhost:6001"
                      className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Comprar EURT →
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={pay}
                    disabled={isPaying}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-xl py-3 font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {status === "connected" && `Pagar ${amountStr} EURT`}
                    {status === "approving" && "⏳ Aprobando tokens…"}
                    {status === "processing" && "⏳ Procesando pago…"}
                    {status === "confirming" && "⏳ Confirmando…"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
