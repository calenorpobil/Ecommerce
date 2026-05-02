"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10000;

// --- Formulario interno (dentro de <Elements>) ---
function CheckoutForm({
  amount,
  walletAddress,
  onSuccess,
}: {
  amount: number;
  walletAddress: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setError(null);
    setProcessing(true);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Error al enviar formulario");
      setProcessing(false);
      return;
    }

    // Crear Payment Intent en el backend
    let clientSecret: string;
    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, walletAddress }),
      });
      if (!res.ok) throw new Error("No se pudo crear el pago");
      const data = await res.json();
      clientSecret = data.clientSecret;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de red");
      setProcessing(false);
      return;
    }

    // Confirmar pago con Stripe
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/success`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Pago fallido");
      setProcessing(false);
      return;
    }

    // Pago completado → mint directo para que el balance esté actualizado al mostrar éxito
    // El webhook actúa como fallback si el usuario cierra la pestaña antes de llegar aquí
    const paymentIntentId = clientSecret.split("_secret_")[0];
    try {
      const mintRes = await fetch("/api/mint-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
      if (!mintRes.ok) {
        const text = await mintRes.text();
        let message = "Error al acreditar tokens";
        try {
          message = JSON.parse(text)?.error ?? message;
        } catch { /* respuesta no-JSON, usar mensaje por defecto */ }
        throw new Error(message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Pago confirmado pero no se pudieron acreditar los tokens");
      setProcessing(false);
      return;
    }

    onSuccess();
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-gray-50 border rounded-lg p-4">
        <PaymentElement />
      </div>
      {error && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded p-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
      >
        {processing ? "Procesando..." : `Pagar ${amount} € y recibir ${amount} EURT`}
      </button>
    </form>
  );
}

// --- Componente principal ---
interface PurchaseFormProps {
  walletAddress: string;
  onPurchaseSuccess: () => void;
}

export default function PurchaseForm({
  walletAddress,
  onPurchaseSuccess,
}: PurchaseFormProps) {
  const [amount, setAmount] = useState<number>(100);
  const [showPayment, setShowPayment] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const handleAmountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      setInputError(`Ingresa un monto entre ${MIN_AMOUNT} y ${MAX_AMOUNT} EUR`);
      return;
    }
    setShowPayment(true);
  };

  if (showPayment) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Datos de pago</h3>
          <button
            onClick={() => setShowPayment(false)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← Cambiar monto
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Recibirás <strong>{amount} EURT</strong> en tu wallet tras confirmar el pago.
        </p>
        <Elements
          stripe={stripePromise}
          options={{
            mode: "payment",
            amount: amount * 100, // Stripe usa centavos
            currency: "eur",
          }}
        >
          <CheckoutForm
            amount={amount}
            walletAddress={walletAddress}
            onSuccess={onPurchaseSuccess}
          />
        </Elements>
      </div>
    );
  }

  return (
    <form onSubmit={handleAmountSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="amount"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Cantidad a comprar (EUR = EURT)
        </label>
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
          <span className="bg-gray-100 px-3 py-2 text-gray-500 font-semibold border-r border-gray-300">
            €
          </span>
          <input
            id="amount"
            type="number"
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            step="1"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="flex-1 px-3 py-2 outline-none text-lg"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Mínimo {MIN_AMOUNT} EUR · Máximo {MAX_AMOUNT} EUR por transacción
        </p>
      </div>
      {inputError && (
        <p className="text-red-500 text-sm">{inputError}</p>
      )}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
        Recibirás exactamente <strong>{amount} EURT</strong> (1 EUR = 1 EURT)
      </div>
      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
      >
        Continuar con el pago →
      </button>
    </form>
  );
}
