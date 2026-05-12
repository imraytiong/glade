import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('WYSIWYG Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/?test=editor');
    // Wait for editor to be ready
    await page.waitForSelector('.ProseMirror');
  });

  const loadFixture = async (page: any, fixtureName: string) => {
    const content = fs.readFileSync(path.resolve(process.cwd(), `e2e/fixtures/${fixtureName}`), 'utf-8');
    // With Milkdown, we don't have the simple window.setEditorContent hack yet.
    // We can simulate it by clearing the editor and typing/pasting, or exposing a new hook.
    // For now, we will just clear and paste.
    const pm = page.locator('.ProseMirror');
    await pm.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.evaluate((text: string) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      const event = new ClipboardEvent('paste', { clipboardData, bubbles: true });
      document.querySelector('.ProseMirror')?.dispatchEvent(event);
    }, content);
    await page.waitForTimeout(100);
  };

  test('should render markdown without exposing syntax', async ({ page }) => {
    // Paste "**Bold Text**" into the editor
    const pm = page.locator('.ProseMirror');
    await pm.click();
    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', '**Bold Text**');
      const event = new ClipboardEvent('paste', { clipboardData, bubbles: true });
      document.querySelector('.ProseMirror')?.dispatchEvent(event);
    });
    
    // It should render a <strong> element and no asterisks
    await expect(pm.locator('strong')).toHaveText('Bold Text');
    const text = await pm.textContent();
    expect(text).not.toContain('*');
  });

  test('should apply hotkeys for bold', async ({ page }) => {
    const pm = page.locator('.ProseMirror');
    await pm.click();
    
    // Type "Hello "
    await page.keyboard.type('Hello ');
    
    await page.keyboard.press('Meta+b');
    await page.keyboard.press('Control+b');
    await page.keyboard.type('World');
    
    // It should render "Hello " and <strong>World</strong>
    await expect(pm.locator('strong')).toHaveText('World');
  });

});
