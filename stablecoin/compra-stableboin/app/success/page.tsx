"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const paymentIntentId = searchParams.get("payment_intent");
    if (!paymentIntentId) {
      setStatus("error");
      return;
    }

    fetch(`/api/verify-payment?payment_intent=${paymentIntentId}`)
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status === "succeeded" ? "ok" : "error");
      })
      .catch(() => setStatus("error"));
  }, [searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center flex flex-col gap-4">
        {status === "loading" && <p className="text-gray-500">Verificando pago...</p>}
        {status === "ok" && (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold text-green-700">¡Pago completado!</h1>
            <p className="text-gray-500 text-sm">
              Tu pago fue procesado. Los EuroTokens serán acreditados a tu
              wallet en breve.
            </p>
            <a
              href="/"
              className="mt-2 inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Volver al inicio
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-5xl">❌</div>
            <h1 className="text-2xl font-bold text-red-600">Error en el pago</h1>
            <p className="text-gray-500 text-sm">
              No pudimos verificar tu pago. Contacta con soporte si el cargo
              fue realizado.
            </p>
            <a
              href="/"
              className="mt-2 inline-block bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              Intentar de nuevo
            </a>
          </>
        )}
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-gray-500">Cargando...</p>}>
      <SuccessContent />
    </Suspense>
  );
}
