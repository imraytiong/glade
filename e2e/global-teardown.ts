import { stopMockServer } from './mock-server';

async function globalTeardown() {
  await stopMockServer();
}

export default globalTeardown;
