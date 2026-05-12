import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('WYSIWYG Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420/?test=editor');
    // Wait for editor to be ready
    await page.waitForSelector('.cm-content');
  });

  const loadFixture = async (page: any, fixtureName: string) => {
    const content = fs.readFileSync(path.resolve(process.cwd(), `e2e/fixtures/${fixtureName}`), 'utf-8');
    await page.evaluate((text: string) => {
      (window as any).setEditorContent(text);
    }, content);
    // wait a moment for react to re-render
    await page.waitForTimeout(100);
  };

  test('should hide markdown syntax by default and expose on Mod-Alt-M', async ({ page }) => {
    await loadFixture(page, 'test_formatting.md');

    // Asterisks and hashes should be hidden (have .cm-hidden-markup class)
    const hiddenMarkups = page.locator('.cm-hidden-markup');
    await expect(hiddenMarkups.first()).toBeAttached();
    // They should have zero font size or transparent color
    const styles = await hiddenMarkups.first().evaluate((node) => {
      const s = window.getComputedStyle(node);
      return { opacity: s.opacity, display: s.display, width: s.width };
    });
    expect(styles.opacity).toBe('0');

    // Toggle Mod-Alt-M
    await page.locator('.cm-content').press('Meta+Alt+m');
    await page.locator('.cm-content').press('Control+Alt+m');
    
    // Hidden markups should now be visible (no .cm-hidden-markup class)
    await expect(page.locator('.cm-hidden-markup')).toHaveCount(0);
  });

  test('should apply hotkeys for bold and italic', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).setEditorContent('Hello World');
    });
    await page.waitForTimeout(100);

    const content = page.locator('.cm-content');
    await content.click();
    await page.keyboard.press('End');
    
    // Select "World"
    await page.keyboard.down('Shift');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowLeft');
    }
    await page.keyboard.up('Shift');

    // Apply Bold
    // Try both Meta and Control to ensure it hits Mod
    await page.keyboard.press('Meta+b');
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(50);

    // Verify
    // Hidden markup asterisks are replaced by cm-hidden-markup spans
    const html = await content.innerHTML();
    expect(html).toContain('cm-hidden-markup');
  });

  test('should apply hotkeys for block formatting', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).setEditorContent('Hello World');
    });
    await page.waitForTimeout(100);

    const content = page.locator('.cm-content');
    await content.click();
    
    // Apply Header 1 (Cmd+Alt+1 or Ctrl+Alt+1)
    await page.keyboard.press('Meta+Alt+1');
    await page.keyboard.press('Control+Alt+1');

    // Verify it added `# ` which is now a hidden markup span
    let html = await content.innerHTML();
    expect(html).toContain('cm-hidden-markup');

    // Apply Bulleted List (Cmd+Shift+8 or Ctrl+Shift+8)
    await page.keyboard.press('Meta+Shift+8');
    await page.keyboard.press('Control+Shift+8');

    // Verify it replaced `# ` with bullet, which might also be a widget
    html = await content.innerHTML();
    expect(html).toContain('•');
    
    // Apply Normal Text (Cmd+Alt+0)
    await page.keyboard.press('Meta+Alt+0');
    await page.keyboard.press('Control+Alt+0');

    // Verify it stripped the prefix
    const text = await content.textContent();
    expect(text).toBe('Hello World');
  });

  test('should not auto-format typed markdown and should support slash menu', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).setEditorContent('');
    });
    await page.waitForTimeout(100);

    const content = page.locator('.cm-content');
    await content.click();
    
    // Type `# ` manually
    await page.keyboard.type('# ');
    await page.keyboard.type('Hello');

    // Verify it was escaped and is NOT a heading
    let html = await content.innerHTML();
    expect(html).not.toContain('cm-heading');
    
    // Verify the escape backslash is in the DOM (it should be wrapped in EscapeWidget, but the textContent of the widget is just `#`)
    const text = await content.textContent();
    expect(text).toBe('# Hello');

    // Clear the editor properly
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(50);

    await page.keyboard.type('/h1');
    await page.waitForSelector('.cm-tooltip-autocomplete');
    await page.waitForTimeout(50); // wait for options to be selected
    await page.keyboard.press('Enter');
    await page.keyboard.type('Hello');

    // Verify it IS a heading now and has hidden markup (which hides the `# `)
    html = await content.innerHTML();
    expect(html).toContain('cm-hidden-markup');
    
    // The visual text should just be " Hello" because the `#` is hidden, but the space after it is kept visible so the caret renders
    const text2 = await content.textContent();
    expect(text2).toBe(' Hello');
  });

  test('should render code block language selector', async ({ page }) => {
    const content = `\`\`\`typescript\nconst a = 1;\n\`\`\``;
    await page.evaluate((text: string) => {
      (window as any).setEditorContent(text);
    }, content);
    await page.waitForTimeout(100);

    // Verify the widget exists
    const select = page.locator('.cm-code-lang-select');
    await expect(select).toHaveCount(1);
    await expect(select).toHaveValue('typescript');

    // Change language to python
    await select.selectOption('python');
    await page.waitForTimeout(100);

    // Verify the text changed
    const editorText = await page.locator('.cm-content').textContent();
    expect(editorText).toMatch(/python/i);
  });

  test('should render and interact with table widget', async ({ page }) => {
    const content = `| Col 1 | Col 2 |\n|---|---|\n| A | B |\n| C | D |`;
    await page.evaluate((text: string) => {
      (window as any).setEditorContent(text);
    }, content);
    await page.waitForTimeout(100);

    // Verify the widget exists
    const table = page.locator('.cm-table');
    await expect(table).toHaveCount(1);
    
    // Verify rows and columns
    const rows = table.locator('tr');
    await expect(rows).toHaveCount(3); // 1 header + 2 data rows

    // Edit a cell
    const cellA = table.locator('td').filter({ hasText: 'A' });
    await cellA.click();
    // In contenteditable, clicking focuses it. We can type.
    await page.keyboard.press('End');
    await page.keyboard.type(' modified');
    await cellA.blur(); // Trigger blur to save
    await page.waitForTimeout(100);

    // Verify the text changed in editor content
    const editorText = await page.locator('.cm-content').textContent();
    expect(editorText).toMatch(/A modified/);

    // Add a row
    const btnRow = page.locator('button.cm-table-btn').filter({ hasText: '+ Row' });
    await btnRow.click();
    await page.waitForTimeout(100);

    // Verify it added a row (total 4)
    await expect(table.locator('tr')).toHaveCount(4);

    // Add a col
    const btnCol = page.locator('button.cm-table-btn').filter({ hasText: '+ Col' });
    await btnCol.click();
    await page.waitForTimeout(100);

    // Verify it added a col (3 columns in header)
    await expect(table.locator('th')).toHaveCount(3);
  });
});
