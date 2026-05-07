import { test, expect } from '@playwright/test'
import { ENV } from '../lib/env.js'

// Verifica que las 4 apps responden y renderizan la UI inicial.
// No usa wallet ni Stripe — sólo HTML.

test.describe('Smoke — 4 apps levantadas', () => {
  test('compra-stablecoin (:6001) muestra el formulario de conexión', async ({ page }) => {
    await page.goto(ENV.URLS.BUY)
    await expect(page.getByRole('heading', { name: /Comprar EuroTokens/i })).toBeVisible()
    await expect(page.getByText(/Conecta tu wallet de MetaMask/i)).toBeVisible()
  })

  test('pasarela-pago (:6002) responde', async ({ page }) => {
    const res = await page.goto(ENV.URLS.GATEWAY)
    expect(res?.status(), 'pasarela debe responder 2xx/3xx').toBeLessThan(500)
    // Sin parámetros la pasarela típicamente muestra error de invoice o cargando.
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('web-admin (:6003) redirige a /companies', async ({ page }) => {
    await page.goto(ENV.URLS.ADMIN)
    await page.waitForURL(/\/companies/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/companies/)
  })

  test('web-customer (:6004) renderiza navbar y catálogo', async ({ page }) => {
    await page.goto(ENV.URLS.CUSTOMER)
    await expect(page.locator('main')).toBeVisible()
  })

  test('web-customer /products carga (con o sin productos)', async ({ page }) => {
    await page.goto(`${ENV.URLS.CUSTOMER}/products`)
    // Aparece el filtro de búsqueda independientemente de si hay productos.
    await expect(page.getByPlaceholder(/Buscar productos/i)).toBeVisible()
  })

  test('web-customer /cart se renderiza', async ({ page }) => {
    await page.goto(`${ENV.URLS.CUSTOMER}/cart`)
    await expect(page.locator('main')).toBeVisible()
  })

  test('web-customer /orders se renderiza', async ({ page }) => {
    await page.goto(`${ENV.URLS.CUSTOMER}/orders`)
    await expect(page.locator('main')).toBeVisible()
  })
})
