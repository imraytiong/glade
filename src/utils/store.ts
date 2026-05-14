import { load as tauriLoad } from '@tauri-apps/plugin-store';
import { invoke } from './api';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface HeadlessStore {
    get: <T>(key: string) => Promise<T | undefined | null>;
  set: (key: string, value: any) => Promise<void>;
  save: () => Promise<void>;
}

export async function load(path: string, options?: any): Promise<HeadlessStore> {
  if (isTauri) {
    const store = await tauriLoad(path, options);
    return {
      get: <T>(key: string) => store.get<T>(key),
      set: (key: string, value: any) => store.set(key, value),
      save: () => store.save()
    };
  }

  // Headless fallback
  return {
    get: async <T>(key: string) => {
      return invoke<T | null>('store_get', { path, key });
    },
    set: async (key: string, value: any) => {
      return invoke<void>('store_set', { path, key, value });
    },
    save: async () => {
      return invoke<void>('store_save', { path });
    }
  };
}
