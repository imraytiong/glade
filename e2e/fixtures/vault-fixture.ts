import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type VaultFixture = {
  dynamicVaultPath: string;
};

export const test = base.extend<VaultFixture>({
  dynamicVaultPath: async ({}, use, testInfo) => {
    const templatePath = path.join(process.cwd(), 'e2e', 'fixtures', 'base-vault');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `glade-test-${testInfo.workerIndex}-`));
    
    function copyDir(src: string, dest: string) {
      fs.mkdirSync(dest, { recursive: true });
      let entries = fs.readdirSync(src, { withFileTypes: true });

      for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    copyDir(templatePath, tempDir);

    await use(tempDir);

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`Failed to cleanup temp dir ${tempDir}`, e);
    }
  },
  clearMockServer: [async ({ request }, use) => {
    try {
      await request.post('http://localhost:1422/clear-mock-requests');
      await request.post('http://localhost:1422/set-mock-response', {
        data: { responses: [] }
      });
    } catch (e) {
      // Mock server might not be running
    }
    await use();
  }, { auto: true }],
});

export { expect };
