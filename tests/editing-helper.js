export async function edit(page) {
  if (await page.locator('#toggle-editing').getAttribute('aria-pressed') !== 'true') await page.locator('#toggle-editing').click();
}
