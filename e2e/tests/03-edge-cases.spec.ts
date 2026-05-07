import { test, expect } from '@playwright/test'
import { ANVIL_ACCOUNTS, ENV } from '../lib/env.js'
import {
  addProduct,
  addToCart,
  approveEURT,
  createInvoice,
  eurt,
  getCompanyIdByAddress,
  getProductsByCompany,
  lastInvoiceIdFor,
  processPayment,
  registerCompany,
  waitTx,
} from '../lib/onchain.js'

// Edge cases del SKILL Parte 8 — adaptados al nivel on-chain.

const OWNER = ANVIL_ACCOUNTS[0]
const COMPANY_A = ANVIL_ACCOUNTS[1]
const COMPANY_B = ANVIL_ACCOUNTS[2]
const CUSTOMER = ANVIL_ACCOUNTS[3]

async function ensureCompany(pk: `0x${string}`, addr: `0x${string}`, name: string) {
  const id = await getCompanyIdByAddress(addr)
  if (id > 0n) return id
  await waitTx(await registerCompany(OWNER.pk, addr, name, 'desc', `B-${addr.slice(2, 10)}`))
  return getCompanyIdByAddress(addr)
}

test.describe('Edge cases on-chain', () => {
  test('Producto sin stock: addToCart revierte (InsufficientStock)', async () => {
    const companyId = await ensureCompany(COMPANY_A.pk, COMPANY_A.address, 'Empresa A')
    await waitTx(await addProduct(COMPANY_A.pk, companyId, 'NoStock', 'sin stock', '5', 1))
    const ids = await getProductsByCompany(companyId)
    const productId = ids[ids.length - 1]

    await expect(
      addToCart(CUSTOMER.pk, productId, 999),
    ).rejects.toThrow(/InsufficientStock|reverted|stock/i)
  })

  test('Modificar producto de otra empresa revierte (NotAuthorized)', async () => {
    const idA = await ensureCompany(COMPANY_A.pk, COMPANY_A.address, 'Empresa A')
    await ensureCompany(COMPANY_B.pk, COMPANY_B.address, 'Empresa B')
    await waitTx(await addProduct(COMPANY_A.pk, idA, 'Mio A', 'desc', '1', 10))
    const ids = await getProductsByCompany(idA)
    const productId = ids[ids.length - 1]

    // Empresa B intenta cambiar stock de un producto de empresa A
    await expect(
      // updateStock no está en helpers de alto nivel — lo invocamos vía writeContract
      (async () => {
        const { walletFor, anvilChain } = await import('../lib/onchain.js')
        const { ECOMMERCE_ABI } = await import('../lib/abi.js')
        const w = walletFor(COMPANY_B.pk)
        return w.writeContract({
          chain: anvilChain,
          account: w.account!,
          address: ENV.ECOMMERCE,
          abi: ECOMMERCE_ABI,
          functionName: 'updateStock',
          args: [productId, 0n],
        })
      })(),
    ).rejects.toThrow(/NotAuthorized|reverted/i)
  })

  test('Pagar sin saldo / sin allowance suficiente revierte (Insufficient*)', async () => {
    const companyId = await ensureCompany(COMPANY_A.pk, COMPANY_A.address, 'Empresa A')
    await waitTx(await addProduct(COMPANY_A.pk, companyId, 'Caro', 'desc', '99999999', 5))
    const ids = await getProductsByCompany(companyId)
    const productId = ids[ids.length - 1]

    // Customer "fresco" sin minted: usamos cuenta 4 que no tiene EURT
    const POOR = {
      address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' as const,
      pk: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' as const,
    }

    await waitTx(await addToCart(POOR.pk, productId, 1))
    await waitTx(await createInvoice(POOR.pk, companyId))
    const invoiceId = await lastInvoiceIdFor(POOR.address)

    // Sin approve previo → InsufficientAllowance
    await expect(processPayment(POOR.pk, invoiceId)).rejects.toThrow(/InsufficientAllowance|reverted/i)

    // Aprobamos, pero seguimos sin saldo → InsufficientBalance
    await waitTx(await approveEURT(POOR.pk, ENV.ECOMMERCE, eurt('99999999')))
    await expect(processPayment(POOR.pk, invoiceId)).rejects.toThrow(/InsufficientBalance|reverted/i)
  })

  test('Pagar dos veces la misma invoice revierte (InvoiceAlreadyPaid)', async () => {
    const { mintEURT } = await import('../lib/onchain.js')
    const companyId = await ensureCompany(COMPANY_A.pk, COMPANY_A.address, 'Empresa A')
    await waitTx(await addProduct(COMPANY_A.pk, companyId, 'Doble', 'desc', '1', 10))
    const ids = await getProductsByCompany(companyId)
    const productId = ids[ids.length - 1]

    await waitTx(await mintEURT(CUSTOMER.address, '5'))
    await waitTx(await addToCart(CUSTOMER.pk, productId, 1))
    await waitTx(await createInvoice(CUSTOMER.pk, companyId))
    const invoiceId = await lastInvoiceIdFor(CUSTOMER.address)
    await waitTx(await approveEURT(CUSTOMER.pk, ENV.ECOMMERCE, eurt('5')))
    await waitTx(await processPayment(CUSTOMER.pk, invoiceId))

    await expect(processPayment(CUSTOMER.pk, invoiceId)).rejects.toThrow(/InvoiceAlreadyPaid|reverted/i)
  })

  test('Pasarela sin invoiceId muestra error / no rompe (UI)', async ({ page }) => {
    // El SKILL menciona "Pagar sin saldo redirige a /buy-tokens" — ese flujo necesita wallet.
    // Aquí verificamos al menos que la pasarela no se cae con params inválidos.
    const res = await page.goto(`${ENV.URLS.GATEWAY}/?invoice=999999`)
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toBeEmpty()
  })
})
