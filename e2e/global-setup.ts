import { startMockServer } from './mock-server';

async function globalSetup() {
  await startMockServer(1422);
}

export default globalSetup;
