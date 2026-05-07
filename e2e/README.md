# E2E Tests — Parte 8 (testing-sistema)

Suite de tests automatizados que cubre el SKILL `testing-sistema/SKILL.md`.

## Qué cubre

1. **Smoke UI** (`tests/01-smoke.spec.ts`) — verifica que las 4 apps responden y renderizan elementos clave.
2. **Happy path on-chain** (`tests/02-onchain-happy-path.spec.ts`) — registra empresa, añade productos, llena carrito, crea invoice, paga, verifica balance + stock. Sustituye MetaMask y Stripe por firmas con claves privadas locales y `mint()` del owner del EuroToken.
3. **Edge cases** (`tests/03-edge-cases.spec.ts`):
   - producto sin stock (`InsufficientStock`)
   - modificar producto de otra empresa (`NotAuthorized`)
   - pagar sin allowance (`InsufficientAllowance`) y sin saldo (`InsufficientBalance`)
   - pagar dos veces la misma invoice (`InvoiceAlreadyPaid`)
   - pasarela con invoiceId inexistente no rompe

## Lo que NO cubre (y por qué)

| Caso del SKILL | Razón |
|---|---|
| Compra Stripe con tarjeta `4242…` | requiere fill del iframe de Stripe Elements + 3DS de prueba; sustituido por `mint()` directo |
| Conectar MetaMask y firmar | Playwright nativo no controla extensiones; harían falta Synpress + setup de extensión |
| Cambiar de cuenta en MetaMask en mitad del flujo | mismo motivo |
| Capturas de pantalla manuales | Playwright las genera automáticas en fallo (`screenshot: 'only-on-failure'`) |

Si en el futuro quieres cubrir lo de MetaMask, instala `@synthetixio/synpress` y reemplaza el bloque "approve + processPayment" del happy path por flujo en navegador.

## Requisitos

- Stack levantado: `./restart-all.sh` debe haber terminado correctamente. Las direcciones de contratos se leen de los `.env.local` de cada app.
- Anvil RPC en `http://localhost:8545` con las cuentas deterministas estándar.

## Instalación

```bash
cd e2e
npm install
npx playwright install chromium
```

## Ejecución

```bash
# Toda la suite
npm test

# Sólo smoke UI
npm run test:smoke

# Sólo flujos on-chain (happy path)
npm run test:onchain

# Sólo edge cases
npm run test:edge

# UI interactiva
npm run test:ui

# Ver reporte HTML del último run
npm run report
```

## Estructura

```
e2e/
├── lib/
│   ├── env.ts        # lee .env.local de las 4 apps + cuentas Anvil
│   ├── abi.ts        # ABIs combinadas
│   └── onchain.ts    # helpers viem (mint, register, addProduct, processPayment, …)
├── tests/
│   ├── 01-smoke.spec.ts
│   ├── 02-onchain-happy-path.spec.ts
│   └── 03-edge-cases.spec.ts
├── playwright.config.ts
└── package.json
```

## Notas

- Los tests asumen Anvil con state limpio (post `restart-all.sh`). Si re-ejecutas sin reiniciar, los tests son idempotentes en su mayoría: el happy-path reusa la empresa si ya existe y añade productos nuevos en cada run.
- Las cuentas Anvil usadas:
  - `0` → owner / deployer (mintea EURT)
  - `1` → empresa A ("Mi Tienda")
  - `2` → empresa B (edge case "otra empresa")
  - `3` → cliente principal
  - `4` → cliente sin saldo (edge case)
- Coverage objetivo del SKILL (`forge coverage` ≥ 80%) se mide en el repo `sc-ecommerce`, no aquí.
