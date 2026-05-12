import { test, expect } from '@playwright/test';

test('cursor test', async ({ page }) => {
  await page.goto('http://localhost:1420');
  const content = page.locator('.cm-content');
  await content.click();
  await page.waitForTimeout(100);
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);
  
  await page.keyboard.type('  -');
  await page.waitForTimeout(100);
  
  await page.keyboard.type('X');
  await page.waitForTimeout(100);
  
  const text = await content.textContent();
  console.log("Result:", text);
});
