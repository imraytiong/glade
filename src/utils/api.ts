import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen, EventCallback, UnlistenFn } from '@tauri-apps/api/event';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * A wrapper around Tauri's invoke that falls back to HTTP POST requests
 * when running in headless mode (e.g. Playwright testing).
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return tauriInvoke<T>(cmd, args);
  } else {
    const url = `http://127.0.0.1:1421/api/${cmd}`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args || {}),
      });
    } catch (err) {
      console.error(`Fetch failed for cmd: ${cmd}`, err);
      throw err;
    }

    if (!response.ok) {
      let errorMsg = `HTTP error! status: ${response.status}`;
      try {
        errorMsg = await response.text();
      } catch (e) {
        // ignore
      }
      throw new Error(errorMsg);
    }

    // Some commands might return empty bodies (like save_agent)
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    
    // Do not auto-parse if the command is meant to return raw text
    if (cmd === 'fs_read_text_file') {
      return text as unknown as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (e) {
      // If it's not JSON, it might just be a string response
      return text as unknown as T;
    }
  }
}

export async function listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn> {
  if (isTauri) {
    return tauriListen(event, handler);
  }
  
  // Mock listener for E2E tests
  const wrapper = (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent.detail && customEvent.detail.event === event) {
      handler({
        event: event,
        id: Math.random(),
        payload: customEvent.detail.payload as T
      });
    }
  };
  
  window.addEventListener('mock-tauri-event', wrapper);
  return () => {
    window.removeEventListener('mock-tauri-event', wrapper);
  };
}

