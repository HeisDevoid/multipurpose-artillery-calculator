import { expect, test, type Page } from '@playwright/test'

/**
 * Smoke tests of the built site: the main things work from start to finish.
 * Console errors and unhandled exceptions fail a test.
 */

async function open(page: Page, path = '/', storage: Record<string, string> = {}) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.addInitScript((values) => {
    // No tutorial and no physics question on the first start; the test sets the language and the map
    localStorage.setItem('tourDone', 'yes')
    localStorage.setItem('tourAdvancedDone', 'yes')
    localStorage.setItem('physicsAsked', 'yes')
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
  }, { language: 'en', mapWorld: 'builtin:stratis', ...storage })
  await page.goto(path)
  return errors
}

test('the main page opens without errors', async ({ page }) => {
  // MQTT (~330 KB) is needed only for Link: it is not loaded on a normal start
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })
  const errors = await open(page)
  await expect(page.getByText('Elevation', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Fire/ }).first()).toBeVisible()
  await expect(page.locator('#calc-distance')).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(scripts.filter((url) => /mqtt/i.test(url))).toEqual([])
  expect(errors).toEqual([])
})

test('an entered distance gives an elevation', async ({ page }) => {
  const errors = await open(page, '/', { selectedModel: 'mk6' })
  await page.locator('#calc-distance').fill('1000')
  const elevation = page.locator('.row', { hasText: 'Elevation' }).first()
  // The number in mils appears (digits are animated: wait until it is a number)
  await expect(elevation).toContainText(/\d{3,4}/, { timeout: 10_000 })
  expect(errors).toEqual([])
})

test('the map loads, clicks place the gun and the target', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the right mouse button exists only on a computer')
  const errors = await open(page)
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('no gun', { exact: false })).toBeVisible()
  const box = (await canvas.boundingBox())!
  // Stratis: the island is in the middle of the map
  await canvas.click({ position: { x: box.width * 0.45, y: box.height * 0.5 } })
  await canvas.click({ position: { x: box.width * 0.55, y: box.height * 0.45 }, button: 'right' })
  await expect(page.locator('#calc-distance')).not.toHaveValue('', { timeout: 10_000 })
  const distance = Number(await page.locator('#calc-distance').inputValue())
  expect(distance).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('changing the language translates the interface', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('option', { name: /Deutsch/ }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByText('Erhöhung', { exact: false }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('the settings open and lead back', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('switch').first()).toBeVisible()
  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.locator('#calc-distance')).toBeVisible()
  expect(errors).toEqual([])
})

test('an app crash shows the error screen instead of a white page', async ({ page }) => {
  await open(page, '/?crashtest=app')
  await expect(page.getByRole('alert')).toContainText('Something broke')
  await expect(page.getByRole('button', { name: /Reload/ })).toBeVisible()
})

test('a map crash does not break the calculator', async ({ page }) => {
  await open(page, '/?crashtest=map')
  await expect(page.getByRole('alert')).toContainText('The map did not open')
  await expect(page.locator('#calc-distance')).toBeVisible()
})

test('weapons without both table sets are not in the list', async ({ page }) => {
  // M2 (S.O.G.) has no tables without air resistance: the stored choice changes to Mk6
  const errors = await open(page, '/', { selectedModel: 'm2' })
  const select = page.getByRole('button', { name: 'Game Model' })
  // The button shows the name without the calibre, the calibre is in the open list
  await expect(select).toHaveText('Mk6')
  await expect(page.locator('[data-status="incomplete"]')).toHaveCount(0)
  await select.click()
  const list = page.getByRole('listbox', { name: 'Game Model' })
  await expect(list.getByRole('option', { name: /Sholef/ })).toBeVisible()
  await expect(list.getByRole('option', { name: /Mk6 \(82 mm\)/ })).toBeVisible()
  // Seara has tables without air resistance at all ranges up to the ACE limit (29,900 m)
  await expect(list.getByRole('option', { name: /Seara/ })).toBeVisible()
  await list.getByRole('option', { name: /Mods and DLC/ }).click()
  await page.getByPlaceholder('Search weapons or mods…').fill('S.O.G.')
  await expect(page.getByRole('dialog').getByText(/M2 \(60 mm\)|M29|M101|D-44|H-12|Type 53|Type 63/)).toHaveCount(0)
  await page.getByPlaceholder('Search weapons or mods…').fill('HIMARS')
  await expect(page.getByRole('dialog').getByText('M142 HIMARS (227 mm)')).toBeVisible()
  expect(errors).toEqual([])
})

test('the drawing toolbar and the map layer are in place', async ({ page }) => {
  const errors = await open(page)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Drawing' }).click()
  await expect(page.getByRole('button', { name: 'Pencil' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Straight line' })).toBeVisible()
  await page.getByRole('button', { name: 'Show the topographic map' }).click()
  await expect(page.getByRole('button', { name: 'Show the satellite image' })).toBeVisible()
  expect(errors).toEqual([])
})

test('a link with ?lang= opens its language: interface, tab title, description', async ({ page }) => {
  // English is stored, but the language from the link wins: this is how search sees it
  const errors = await open(page, '/?lang=fr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page).toHaveTitle(/Calculateur d’artillerie Arma 3/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Calculateur de tir/)
  await expect(page.getByText('Élévation', { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('terrain zones: the buttons on the map and the legend', async ({ page }) => {
  const errors = await open(page)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
  const zones = page.getByRole('group', { name: 'Terrain zones' })
  await zones.getByRole('button', { name: 'Where I can hit' }).click()
  await expect(zones.getByRole('button', { name: 'Where I can hit' })).toHaveAttribute('aria-pressed', 'true')
  // No gun on the map: a hint instead of the legend
  await expect(page.getByText('Place the gun on the map.')).toBeVisible()
  expect(errors).toEqual([])
})

test('the first start asks about physics on the server, the answer turns the weather on', async ({ page }) => {
  const errors = await open(page, '/', { physicsAsked: '' })
  const dialog = page.getByRole('dialog', { name: /Important: does your game have air resistance/ })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /Mine has the asterisk/ }).click()
  await expect(dialog).toBeHidden()
  expect(await page.evaluate(() => [localStorage.getItem('physicsAsked'), localStorage.getItem('feature:weather')])).toEqual(['yes', 'on'])
  expect(errors).toEqual([])
})

test('the Tutorial menu is fully on screen', async ({ page }) => {
  // On a phone the button is at the left edge and the list is wider: it used to run off the screen
  const errors = await open(page)
  await page.getByRole('button', { name: /Tutorial/ }).click()
  const box = await page.getByRole('listbox', { name: 'Tutorial' }).boundingBox()
  const width = page.viewportSize()?.width ?? 0
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  expect(errors).toEqual([])
})

test('the help opens from the Tutorial menu', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: /Tutorial/ }).click()
  await page.getByRole('option', { name: /Help and FAQ/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Help' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Why did the shell miss?')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})
