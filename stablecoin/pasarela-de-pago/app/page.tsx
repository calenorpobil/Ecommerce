import { Suspense } from "react";
import PaymentPage from "./components/PaymentPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-400">Cargando…</p>
        </div>
      }
    >
      <PaymentPage />
    </Suspense>
  );
}
