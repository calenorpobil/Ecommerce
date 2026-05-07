import { test, expect } from '@playwright/test'
import { ANVIL_ACCOUNTS, ENV } from '../lib/env.js'
import {
  addProduct,
  addToCart,
  approveEURT,
  balanceOfEURT,
  createInvoice,
  eurt,
  getCart,
  getCompanyIdByAddress,
  getInvoice,
  getProduct,
  getProductsByCompany,
  lastInvoiceIdFor,
  mintEURT,
  processPayment,
  registerCompany,
  waitTx,
} from '../lib/onchain.js'

// Replica los pasos 2-7 del SKILL pero contra los contratos directamente.
// Sustituye MetaMask + Stripe por mint() del owner y firmas con claves privadas locales.

const OWNER = ANVIL_ACCOUNTS[0]
const COMPANY = ANVIL_ACCOUNTS[1]
const CUSTOMER = ANVIL_ACCOUNTS[3]

test.describe('Happy path on-chain (registro → producto → carrito → invoice → pago)', () => {
  test('flujo completo deja invoice marcada como Paid y stock decrementado', async () => {
    // ── Paso 2: "Comprar EURT" — el SKILL usa Stripe; aquí mintamos directamente.
    await waitTx(await mintEURT(CUSTOMER.address, '1000'))
    const balBefore = await balanceOfEURT(CUSTOMER.address)
    expect(balBefore).toBeGreaterThanOrEqual(eurt('1000'))

    // ── Paso 3: registrar empresa "Mi Tienda" + 2 productos
    let companyId: bigint
    const existing = await getCompanyIdByAddress(COMPANY.address)
    if (existing > 0n) {
      companyId = existing
    } else {
      await waitTx(await registerCompany(OWNER.pk, COMPANY.address, 'Mi Tienda', 'Test', 'B-00000001'))
      companyId = await getCompanyIdByAddress(COMPANY.address)
    }
    expect(companyId).toBeGreaterThan(0n)

    await waitTx(await addProduct(COMPANY.pk, companyId, 'Producto A', 'Test A', '10', 100))
    await waitTx(await addProduct(COMPANY.pk, companyId, 'Producto B', 'Test B', '25', 50))
    const productIds = await getProductsByCompany(companyId)
    expect(productIds.length).toBeGreaterThanOrEqual(2)
    const [pA, pB] = [productIds[productIds.length - 2], productIds[productIds.length - 1]]

    const productABefore = (await getProduct(pA)) as any
    const productBBefore = (await getProduct(pB)) as any
    const stockA0 = productABefore.stock as bigint
    const stockB0 = productBBefore.stock as bigint

    // ── Paso 4: customer añade A x2 + B x1 al carrito
    await waitTx(await addToCart(CUSTOMER.pk, pA, 2))
    await waitTx(await addToCart(CUSTOMER.pk, pB, 1))
    const cart = (await getCart(CUSTOMER.address)) as ReadonlyArray<{ productId: bigint; quantity: bigint }>
    expect(cart.length).toBe(2)

    // ── Checkout: createInvoice
    await waitTx(await createInvoice(CUSTOMER.pk, companyId))
    const invoiceId = await lastInvoiceIdFor(CUSTOMER.address)
    const invoice = (await getInvoice(invoiceId)) as any
    expect(invoice.isPaid).toBe(false)
    // 2 * 10 + 1 * 25 = 45 EURT
    expect(invoice.totalAmount).toBe(eurt('45'))

    // ── Paso 5: pasarela — approve + processPayment
    await waitTx(await approveEURT(CUSTOMER.pk, ENV.ECOMMERCE, invoice.totalAmount))
    await waitTx(await processPayment(CUSTOMER.pk, invoiceId))

    // ── Paso 6: invoice marcada Paid
    const invoiceAfter = (await getInvoice(invoiceId)) as any
    expect(invoiceAfter.isPaid).toBe(true)

    // ── Paso 7: empresa recibió tokens, stock decrementado
    const companyBal = await balanceOfEURT(COMPANY.address)
    expect(companyBal).toBeGreaterThanOrEqual(eurt('45'))

    const productAAfter = (await getProduct(pA)) as any
    const productBAfter = (await getProduct(pB)) as any
    expect(productAAfter.stock).toBe(stockA0 - 2n)
    expect(productBAfter.stock).toBe(stockB0 - 1n)
  })
})
