import { expect, test, type Page } from '@playwright/test'

/**
 * Смоук-тесты собранного сайта: главное работает от начала до конца.
 * Ошибки в консоли и необработанные исключения роняют тест.
 */

async function open(page: Page, path = '/', storage: Record<string, string> = {}) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.addInitScript((values) => {
    // Без обучения и вопроса про физику при первом запуске; язык и карта — заданные тестом
    localStorage.setItem('tourDone', 'yes')
    localStorage.setItem('tourAdvancedDone', 'yes')
    localStorage.setItem('physicsAsked', 'yes')
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
  }, { language: 'en', mapWorld: 'builtin:stratis', ...storage })
  await page.goto(path)
  return errors
}

test('главная открывается без ошибок', async ({ page }) => {
  // MQTT (~330 КБ) нужен только для связки — при обычном открытии не грузится
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

test('расчёт по введённой дистанции даёт возвышение', async ({ page }) => {
  const errors = await open(page, '/', { selectedModel: 'mk6' })
  await page.locator('#calc-distance').fill('1000')
  const elevation = page.locator('.row', { hasText: 'Elevation' }).first()
  // Число в мил появляется (анимация цифр — ждём, пока не станет числом)
  await expect(elevation).toContainText(/\d{3,4}/, { timeout: 10_000 })
  expect(errors).toEqual([])
})

test('карта загружается, клики ставят орудие и цель', async ({ page, isMobile }) => {
  test.skip(isMobile, 'правая кнопка мыши — только на компьютере')
  const errors = await open(page)
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('no gun', { exact: false })).toBeVisible()
  const box = (await canvas.boundingBox())!
  // Stratis: остров в середине карты
  await canvas.click({ position: { x: box.width * 0.45, y: box.height * 0.5 } })
  await canvas.click({ position: { x: box.width * 0.55, y: box.height * 0.45 }, button: 'right' })
  await expect(page.locator('#calc-distance')).not.toHaveValue('', { timeout: 10_000 })
  const distance = Number(await page.locator('#calc-distance').inputValue())
  expect(distance).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('смена языка переводит интерфейс', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('option', { name: /Deutsch/ }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByText('Erhöhung', { exact: false }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('настройки открываются и возвращают назад', async ({ page }) => {
  const errors = await open(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('switch').first()).toBeVisible()
  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.locator('#calc-distance')).toBeVisible()
  expect(errors).toEqual([])
})

test('сбой приложения — экран ошибки вместо белой страницы', async ({ page }) => {
  await open(page, '/?crashtest=app')
  await expect(page.getByRole('alert')).toContainText('Something broke')
  await expect(page.getByRole('button', { name: /Reload/ })).toBeVisible()
})

test('сбой карты не ломает калькулятор', async ({ page }) => {
  await open(page, '/?crashtest=map')
  await expect(page.getByRole('alert')).toContainText('The map did not open')
  await expect(page.locator('#calc-distance')).toBeVisible()
})

test('орудий без обоих наборов таблиц в выборе нет', async ({ page }) => {
  // У M2 (S.O.G.) нет таблиц без сопротивления воздуха: сохранённый выбор сменяется на Mk6
  const errors = await open(page, '/', { selectedModel: 'm2' })
  const select = page.getByRole('button', { name: 'Game Model' })
  await expect(select).toContainText('Mk6 (82 mm)')
  await expect(page.locator('[data-status="incomplete"]')).toHaveCount(0)
  await select.click()
  const list = page.getByRole('listbox', { name: 'Game Model' })
  await expect(list.getByRole('option', { name: /Sholef/ })).toBeVisible()
  await expect(list.getByRole('option', { name: /Seara|KamAZ/ })).toHaveCount(0)
  await list.getByRole('option', { name: /Mods and DLC/ }).click()
  await page.getByPlaceholder('Search weapons or mods…').fill('S.O.G.')
  await expect(page.getByRole('dialog').getByText(/M2 \(60 mm\)|M29|M101|D-44|H-12|Type 53|Type 63/)).toHaveCount(0)
  await page.getByPlaceholder('Search weapons or mods…').fill('HIMARS')
  await expect(page.getByRole('dialog').getByText('M142 HIMARS (227 mm)')).toBeVisible()
  expect(errors).toEqual([])
})

test('панель рисования и слой карты на месте', async ({ page }) => {
  const errors = await open(page)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Drawing' }).click()
  await expect(page.getByRole('button', { name: 'Pencil' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Straight line' })).toBeVisible()
  await page.getByRole('button', { name: 'Show the topographic map' }).click()
  await expect(page.getByRole('button', { name: 'Show the satellite image' })).toBeVisible()
  expect(errors).toEqual([])
})

test('ссылка с ?lang= открывает свой язык: интерфейс, заголовок вкладки, описание', async ({ page }) => {
  // Сохранён английский, но язык из ссылки важнее: так её видит поиск
  const errors = await open(page, '/?lang=fr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page).toHaveTitle(/Calculateur d’artillerie Arma 3/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Calculateur de tir/)
  await expect(page.getByText('Élévation', { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('зоны по рельефу: кнопки на карте и легенда', async ({ page }) => {
  const errors = await open(page)
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
  const zones = page.getByRole('group', { name: 'Terrain zones' })
  await zones.getByRole('button', { name: 'Where I can hit' }).click()
  await expect(zones.getByRole('button', { name: 'Where I can hit' })).toHaveAttribute('aria-pressed', 'true')
  // Орудия на карте нет: вместо легенды подсказка
  await expect(page.getByText('Place the gun on the map.')).toBeVisible()
  expect(errors).toEqual([])
})

test('при первом запуске спрашивает про физику на сервере, ответ включает погоду', async ({ page }) => {
  const errors = await open(page, '/', { physicsAsked: '' })
  const dialog = page.getByRole('dialog', { name: /Important: does your game have air resistance/ })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /Mine has the asterisk/ }).click()
  await expect(dialog).toBeHidden()
  expect(await page.evaluate(() => [localStorage.getItem('physicsAsked'), localStorage.getItem('feature:weather')])).toEqual(['yes', 'on'])
  expect(errors).toEqual([])
})

test('справка открывается из меню «Обучение»', async ({ page }) => {
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
