import { test, expect } from '@playwright/test';

test('bold test', async ({ page }) => {
  await page.goto('http://localhost:1420');
  await page.waitForSelector('.cm-content');
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(50);
  
  // Press Cmd+B
  await page.keyboard.press('Meta+b');
  await page.waitForTimeout(50);
  
  const text = await content.textContent();
  const html = await content.innerHTML();
  console.log("TEXT:", text);
  console.log("HTML:", html);
});
