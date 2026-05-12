import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Settings {
  wordWrap: boolean;
  lineNumbers: boolean;
  showBacklinks: boolean;
  typewriterMode: boolean;
  theme: 'system' | 'light' | 'dark';
  fontFamily: 'sans' | 'serif' | 'monospace';
  hotkeys: Record<string, string>;
}

export const defaultSettings: Settings = {
  wordWrap: true,
  lineNumbers: false,
  showBacklinks: true,
  typewriterMode: false,
  theme: 'system',
  fontFamily: 'sans',
  hotkeys: {
    "file.search": "Cmd+O",
    "command.palette": "Cmd+P",
    "app.toggleSidebar": "Cmd+\\",
    "app.closeTab": "Cmd+W",
  }
};

export function mergeSettings(saved: Partial<Settings> | null): Settings {
  if (!saved) return defaultSettings;
  const merged = {
    ...defaultSettings,
    ...saved,
    hotkeys: {
      ...defaultSettings.hotkeys,
      ...(saved.hotkeys || {})
    }
  };

  // Migration to resolve Cmd+F collision with Find & Replace
  if (merged.hotkeys['file.search'] === 'Cmd+F') {
    merged.hotkeys['file.search'] = 'Cmd+O';
  }

  return merged;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('glade_settings');
      return mergeSettings(saved ? JSON.parse(saved) : null);
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem('glade_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const applyTheme = () => {
      let activeTheme = settings.theme;
      if (activeTheme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', activeTheme);
    };

    applyTheme();

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', settings.fontFamily);
  }, [settings.fontFamily]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

