import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comprar EuroTokens",
  description: "Compra EURT con tarjeta de crédito",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
