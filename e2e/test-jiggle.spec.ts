import { test, expect } from '@playwright/test';

test('no jiggle on minus', async ({ page }) => {
  await page.goto('http://localhost:1420');
  const content = page.locator('.cm-content');
  await content.click();
  
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(50);
  
  await page.keyboard.type('Hello');
  await page.keyboard.press('Enter');
  
  let html = await content.innerHTML();
  console.log("Before minus:", html);
  
  await page.keyboard.type('-');
  
  html = await content.innerHTML();
  console.log("After minus:", html);
});
