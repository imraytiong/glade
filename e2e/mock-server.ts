import express from 'express';
import * as http from 'http';

const app = express();
app.use(express.json({ limit: '50mb' }));

// Global state to hold the mocked response for the next request
// This allows a test to set up exactly what the LLM should say.
let nextResponse: any[] = [];
let receivedRequests: any[] = [];

// Endpoint for E2E tests to configure the mock
app.post('/set-mock-response', (req, res) => {
  nextResponse = req.body.responses || [];
  res.json({ success: true });
});

// Endpoint for E2E tests to check what was received
app.get('/get-mock-requests', (req, res) => {
  res.json({ requests: receivedRequests });
});

// Endpoint for E2E tests to clear received requests
app.post('/clear-mock-requests', (req, res) => {
  receivedRequests = [];
  res.json({ success: true });
});

// Mock Gemini Stream endpoint
app.post(/^\/v1beta\/models\/.*/, (req, res) => {
  receivedRequests.push(req.body);
  const isStream = req.url.includes('streamGenerateContent');
  
  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const responses = [...nextResponse]; // Copy the queued responses
    nextResponse = []; // Clear queue for next test

    let index = 0;

    const sendNext = () => {
      if (index < responses.length) {
        const chunk = responses[index];
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        index++;
        setTimeout(sendNext, 50); // Small delay to simulate streaming
      } else {
        res.write(`data: [DONE]\n\n`);
        res.end();
      }
    };

    sendNext();
  } else {
    // Non-streaming mock
    const responses = [...nextResponse];
    nextResponse = [];
    res.json(responses[0] || {});
  }
});

let server: http.Server;

export async function startMockServer(port: number = 1422): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`Mock LLM Server running on port ${port}`);
      resolve();
    });
  });
}

export async function stopMockServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}
