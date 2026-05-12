import { test, expect } from '@playwright/test';

test('caret test', async ({ page }) => {
  await page.goto('http://localhost:1420');
  await page.waitForSelector('.cm-content');
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(50);
  
  await page.keyboard.type('/h1');
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter'); // Select from menu
  
  await page.waitForTimeout(50);
  
  // Try typing
  await page.keyboard.type('A');
  
  const html = await content.innerHTML();
  console.log("HTML:", html);
});
