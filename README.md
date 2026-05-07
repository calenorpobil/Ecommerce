# E-Commerce Blockchain con Stablecoin EURT

Sistema de comercio electrónico descentralizado sobre Ethereum (compatible EVM), con un token estable propio (**EuroToken / EURT**, 1 EURT = 1 EUR) como medio de pago. Incluye smart contracts, panel de administración, tienda para clientes, app de compra fiat→crypto vía Stripe y una pasarela de pago crypto.

---

## Tabla de contenidos

1. [Arquitectura](#1-arquitectura)
2. [Tecnologías](#2-tecnologías)
3. [Quick start](#3-quick-start)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Documentación de API — Smart contracts](#5-documentación-de-api--smart-contracts)
6. [Documentación de API — Endpoints HTTP](#6-documentación-de-api--endpoints-http)
7. [Guía de usuario](#7-guía-de-usuario)
8. [Testing](#8-testing)
9. [Estructura de carpetas](#9-estructura-de-carpetas)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Arquitectura

```
┌──────────────────────┐        ┌──────────────────────┐
│   web-customer:6004  │        │   web-admin:6003     │
│   (tienda online)    │        │   (panel empresas)   │
└──────────┬───────────┘        └──────────┬───────────┘
           │                               │
           │       ethers.js v6            │
           ▼                               ▼
┌─────────────────────────────────────────────────────┐
│       EcommerceMain.sol  +  libs (Cart, Invoice…)   │
│                  EuroToken.sol (ERC20)              │
│                  Anvil / Ethereum (8545)            │
└──────▲──────────────────────────────────────▲───────┘
       │                                      │
       │ approve + processPayment             │ mint
       │                                      │
┌──────┴───────────┐                  ┌───────┴───────────┐
│ pasarela:6002    │                  │ compra-stable:6001│
│ (pago en EURT)   │                  │ (Stripe → mint)   │
└──────────────────┘                  └───────────────────┘
```

Componentes:

- **[sc-ecommerce/](sc-ecommerce/)** — contrato `EcommerceMain` y librerías (Company, Product, Customer, Cart, Invoice, Payment).
- **[stablecoin/sc/](stablecoin/sc/)** — contrato `EuroToken` (ERC20 con 6 decimales).
- **[stablecoin/compra-stableboin/](stablecoin/compra-stableboin/)** — Next.js para comprar EURT con tarjeta vía Stripe.
- **[stablecoin/pasarela-de-pago/](stablecoin/pasarela-de-pago/)** — Next.js que recibe parámetros del comercio y ejecuta `approve` + `processPayment`.
- **[web-admin/](web-admin/)** — panel de empresas: registro, productos, facturas, clientes.
- **[web-customer/](web-customer/)** — tienda: catálogo, carrito on-chain, checkout, historial.
- **[restart-all.sh](restart-all.sh)** / **[deploy.sh](deploy.sh)** — orquestación local.

---

## 2. Tecnologías

| Capa | Stack |
|---|---|
| Smart contracts | Solidity ^0.8.20, Foundry (forge, anvil, cast), OpenZeppelin ERC20 |
| Frontend | Next.js 15 (App Router), TypeScript, TailwindCSS |
| Blockchain client | ethers.js v6 |
| Wallet | MetaMask (EIP-1193) |
| Pagos fiat | Stripe (Payment Intents + Webhooks) |
| Storage off-chain | IPFS vía Pinata (imágenes de producto) |

---

## 3. Quick start

### Requisitos

- Node.js ≥ 18
- npm
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `anvil`, `cast`)
- Cuenta de prueba en [Stripe](https://stripe.com) (opcional, solo para compra fiat)
- MetaMask instalado en el navegador

### Levantar todo el stack

```bash
# Clona el repo y entra
git clone <repo-url> Ecommerce && cd Ecommerce

# Instala dependencias en cada app Next.js
(cd stablecoin/compra-stableboin && npm install)
(cd stablecoin/pasarela-de-pago && npm install)
(cd web-admin && npm install)
(cd web-customer && npm install)

# Compila contratos
(cd stablecoin/sc && forge build)
(cd sc-ecommerce && forge build)

# Levanta Anvil + deploy + 4 apps
./restart-all.sh
```

Servicios resultantes:

| Servicio | URL |
|---|---|
| Anvil RPC | http://localhost:8545 |
| Compra Stablecoin (Stripe) | http://localhost:6001 |
| Pasarela de Pago | http://localhost:6002 |
| Web Admin | http://localhost:6003 |
| Web Customer | http://localhost:6004 |

### MetaMask — añadir red local

- **Network name**: Anvil Local
- **RPC URL**: `http://localhost:8545`
- **Chain ID**: `31337`
- **Currency**: ETH

Importa una de las private keys que muestra Anvil al arrancar (`/tmp/anvil.log`).

---

## 4. Variables de entorno

Las direcciones se inyectan automáticamente al ejecutar [deploy.sh](deploy.sh). Ejemplo del estado tras un deploy:

### `web-admin/.env.local`
```env
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_ECOMMERCE_MAIN_ADDRESS=0x...
NEXT_PUBLIC_EURO_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_PINATA_JWT=eyJhbGc...    # opcional, para subir imágenes
```

### `web-customer/.env.local`
```env
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_ECOMMERCE_MAIN_ADDRESS=0x...
NEXT_PUBLIC_EURO_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_PAYMENT_GATEWAY_URL=http://localhost:6002
```

### `stablecoin/compra-stableboin/.env.local`
```env
NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
WALLET_PRIVATE_KEY=0x...               # owner del EuroToken — firma los mint
```

### `stablecoin/pasarela-de-pago/.env.local`
```env
NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ECOMMERCE_MAIN_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=http://localhost:8545
```

---

## 5. Documentación de API — Smart contracts

### 5.1 EuroToken (ERC20) — [stablecoin/sc/src/EuroToken.sol](stablecoin/sc/src/EuroToken.sol)

ERC20 con 6 decimales, mint controlado por `owner`.

| Función | Visibilidad | Descripción |
|---|---|---|
| `decimals() → uint8` | pure | Devuelve `6`. |
| `mint(address to, uint256 amount)` | onlyOwner | Crea `amount` tokens en `to`. Emite `TokensMinted`. |
| `burn(uint256 amount)` | public | Quema tokens del `msg.sender`. Emite `TokensBurned`. |
| `burnFrom(address account, uint256 amount)` | public | Quema con allowance. |
| `transferOwnership(address newOwner)` | onlyOwner | Cambia el owner que puede mintar. |

Estándar ERC20 completo (`transfer`, `transferFrom`, `approve`, `balanceOf`, `allowance`).

**Errores custom**: `OnlyOwner`, `ZeroAddress`, `ZeroAmount`.

### 5.2 EcommerceMain — [sc-ecommerce/src/EcommerceMain.sol](sc-ecommerce/src/EcommerceMain.sol)

Contrato fachada que orquesta todas las librerías.

#### Empresas

```solidity
function registerCompany(
    address companyAddress,
    string  name,
    string  description,
    string  taxId
) external returns (uint256 companyId);

function deactivateCompany(uint256 companyId) external;
function getCompany(uint256 companyId) external view returns (Company);
function getCompanyIdByAddress(address) external view returns (uint256);
function getAllCompanyIds() external view returns (uint256[]);
```

#### Productos

```solidity
function addProduct(
    uint256 companyId,
    string  name,
    string  description,
    uint256 price,        // En unidades EURT (6 decimales): 10.50 EUR = 10_500_000
    uint256 stock,
    string  ipfsImageHash
) external returns (uint256 productId);

function updateProduct(uint256 productId, string name, string description, uint256 price, string ipfsImageHash) external;
function updateStock(uint256 productId, uint256 newStock) external;
function deactivateProduct(uint256 productId) external;
function getProduct(uint256 productId) external view returns (Product);
function getProductsByCompany(uint256 companyId) external view returns (uint256[]);
```

> **Auth**: solo el `companyAddress` registrado o el `owner` del contrato pueden modificar productos.

#### Carrito

```solidity
function addToCart(uint256 productId, uint256 quantity) external;
function updateCartQuantity(uint256 productId, uint256 quantity) external;
function removeFromCart(uint256 productId) external;
function getCart() external view returns (CartItem[]);
function calculateTotal() external view returns (uint256);
```

#### Facturas

```solidity
function createInvoice(uint256 companyId) external returns (uint256 invoiceId);
function getInvoice(uint256 invoiceId) external view returns (Invoice);
function getInvoiceItems(uint256 invoiceId) external view returns (InvoiceItem[]);
function getCustomerInvoices(address customer) external view returns (uint256[]);
function getCompanyInvoices(uint256 companyId) external view returns (uint256[]);
```

> `createInvoice` exige que **todos los items del carrito** sean de la misma empresa (`MixedCompanies` revert en otro caso). Limpia el carrito al crear la factura.

#### Pagos

```solidity
function processPayment(uint256 invoiceId) external;
function refund(uint256 invoiceId) external;
```

Flujo de `processPayment`:
1. Cliente debe haber hecho `EuroToken.approve(EcommerceMain, totalAmount)`.
2. Transfiere EURT de cliente → `companyAddress`.
3. Marca invoice como pagada.
4. Decrementa stock de cada item.
5. Actualiza estadísticas del cliente.

#### Eventos

```
CompanyRegistered(uint256 indexed companyId, address indexed companyAddress)
ProductAdded(uint256 indexed productId, uint256 indexed companyId)
CartUpdated(address indexed customer)
InvoiceCreated(uint256 indexed invoiceId, address indexed customer, uint256 indexed companyId)
PaymentProcessed(uint256 indexed invoiceId, uint256 amount)
Refunded(uint256 indexed invoiceId)
```

#### Errores

`OnlyOwner`, `NotAuthorized`, `CompanyInactive`, `ProductInactive`, `InsufficientStock`, `EmptyCart`, `MixedCompanies`, `InvoiceAlreadyPaid`, `NotInvoiceOwner`.

---

## 6. Documentación de API — Endpoints HTTP

### 6.1 Compra-stableboin (puerto 6001)

#### `POST /api/create-payment-intent`

Crea un PaymentIntent en Stripe para comprar EURT.

**Request**
```json
{
  "amount": 100,
  "walletAddress": "0xAbC..."
}
```

**Response 200**
```json
{
  "clientSecret": "pi_3Q...secret_...",
  "paymentIntentId": "pi_3Q..."
}
```

#### `POST /api/mint-tokens`

Verifica el pago en Stripe y, si está `succeeded`, hace mint de EURT al wallet.

**Request**
```json
{
  "paymentIntentId": "pi_3Q...",
  "walletAddress": "0xAbC..."
}
```

**Response 200**
```json
{
  "success": true,
  "txHash": "0x9f...",
  "amount": "100.00"
}
```

#### `POST /api/webhook`

Webhook firmado por Stripe (header `Stripe-Signature`). Procesa `payment_intent.succeeded` y dispara mint idempotente.

#### `GET /api/verify-payment?paymentIntentId=...`

Devuelve el estado actual del PaymentIntent.

### 6.2 Pasarela de pago (puerto 6002)

Sin endpoints HTTP propios. Recibe parámetros vía URL:

```
http://localhost:6002/?
  merchant_address=0xCOMPANY_ADDR
  &amount=100.50
  &invoice=42
  &date=2026-05-07
  &redirect=http://localhost:6004/orders
```

Acciones que ejecuta el frontend:

1. `EuroToken.approve(ECOMMERCE_MAIN, amountWei)`
2. `EcommerceMain.processPayment(invoiceId)`
3. Redirección a `redirect` con `?status=success&tx=0x...`

---

## 7. Guía de usuario

### 7.1 Como cliente final

1. **Comprar EURT (si no tienes)**
   - Abre <http://localhost:6001>.
   - Conecta MetaMask.
   - Indica un importe (ej. `100`).
   - Paga con la tarjeta de prueba `4242 4242 4242 4242`, fecha futura, CVC `123`.
   - Verifica el balance al instante en la app o en MetaMask.

2. **Hacer una compra**
   - Abre <http://localhost:6004>.
   - Navega `/products`, añade artículos al carrito (`Add to Cart` requiere wallet conectada).
   - Entra en `/cart`, revisa total, pulsa **Checkout**.
   - Se firma `createInvoice` y serás redirigido a la pasarela.

3. **Pagar la factura**
   - En <http://localhost:6002>, revisa los detalles.
   - Pulsa **Approve** (firma el `approve` del EURT).
   - Pulsa **Pay** (firma el `processPayment`).
   - Al confirmarse, vuelves a `/orders` con la factura marcada como **Paid**.

### 7.2 Como vendedor / empresa

1. Abre <http://localhost:6003> y conecta la wallet de la empresa.
2. **Registrar empresa** desde `/companies` si aún no existe.
3. Entra en `/company/[id]` para gestionar:
   - Añadir productos (nombre, precio en EUR, stock, imagen — se sube a IPFS).
   - Editar / desactivar productos, ajustar stock.
   - Ver lista de facturas y clientes.
4. Cuando un cliente paga, la factura aparece como **Paid** y el balance EURT de la empresa se incrementa automáticamente.

### 7.3 Tarjetas de prueba Stripe útiles

| Tarjeta | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pago exitoso |
| `4000 0000 0000 9995` | Fondos insuficientes |
| `4000 0025 0000 3155` | Requiere autenticación 3DS |

---

## 8. Testing

### Smart contracts

```bash
# EuroToken
cd stablecoin/sc
forge test -vv

# Ecommerce
cd sc-ecommerce
forge test -vv
forge coverage          # cobertura por archivo
```

Suites incluidas: `EuroToken.t.sol`, `CompanyRegistry.t.sol`, `ProductCatalog.t.sol`, `CustomerRegistry.t.sol`, `ShoppingCart.t.sol`, `InvoiceSystem.t.sol`, `PaymentGateway.t.sol`, `Integration.t.sol`.

### End-to-end manual

Flujo recomendado tras `./restart-all.sh`:

1. Comprar 1 000 EURT en :6001.
2. Registrar empresa en :6003 con la wallet B.
3. Añadir productos.
4. Con la wallet A en :6004, comprar productos → checkout → pagar en :6002.
5. Verificar invoice **Paid** en `/orders` y stock decrementado en el panel admin.

---

## 9. Estructura de carpetas

```
Ecommerce/
├── sc-ecommerce/                  # Smart contracts del e-commerce
│   ├── src/
│   │   ├── EcommerceMain.sol
│   │   ├── CompanyRegistry.sol  ProductCatalog.sol
│   │   ├── CustomerRegistry.sol ShoppingCart.sol
│   │   ├── InvoiceSystem.sol    PaymentGateway.sol
│   │   └── libraries/
│   ├── test/
│   └── script/DeployEcommerce.s.sol
├── stablecoin/
│   ├── sc/                        # EuroToken ERC20
│   │   ├── src/EuroToken.sol
│   │   ├── test/EuroToken.t.sol
│   │   └── script/DeployEuroToken.s.sol
│   ├── compra-stableboin/         # Next.js — Stripe → mint
│   └── pasarela-de-pago/          # Next.js — approve + processPayment
├── web-admin/                     # Next.js — panel empresas
├── web-customer/                  # Next.js — tienda
├── e2e/                           # Pruebas end-to-end
├── docs guia/
├── deploy.sh
├── restart-all.sh
└── README.md
```

---

## 10. Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| `nonce too high` en MetaMask | Anvil reiniciado, MetaMask conserva el nonce viejo | Settings → Advanced → **Clear activity tab data** |
| Webhook de Stripe no llega | `stripe listen` no está corriendo | Ejecuta `stripe listen --forward-to localhost:6001/api/webhook` |
| `OnlyOwner` al hacer mint | La `WALLET_PRIVATE_KEY` del backend no es la owner del EURT | Usa la cuenta `[0]` de Anvil (la del deploy) o transfiere ownership |
| Imágenes no cargan | `NEXT_PUBLIC_PINATA_JWT` vacío | Configura un JWT de Pinata o usa URLs públicas |
| `EmptyCart` en checkout | Carrito ya limpiado o cuenta MetaMask distinta | Verifica que la wallet activa sea la misma que añadió al carrito |
| `MixedCompanies` en checkout | El carrito tiene productos de varias empresas | Crea una factura por empresa |

Logs útiles:

```bash
tail -f /tmp/anvil.log
tail -f /tmp/web-admin.log
tail -f /tmp/web-customer.log
tail -f /tmp/compra-stablecoin.log
tail -f /tmp/pasarela-pago.log
```

---

## Licencia

MIT
