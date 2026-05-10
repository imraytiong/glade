import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { expect, test, describe, beforeEach } from 'vitest';
import { SettingsProvider, useSettings } from '../settings';

const TestComponent = () => {
  const { settings, updateSettings } = useSettings();
  return (
    <div>
      <div data-testid="word-wrap">{settings.wordWrap ? 'yes' : 'no'}</div>
      <div data-testid="line-numbers">{settings.lineNumbers ? 'yes' : 'no'}</div>
      <button onClick={() => updateSettings({ wordWrap: !settings.wordWrap })}>
        Toggle Wrap
      </button>
    </div>
  );
};

describe('SettingsProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('loads default settings', () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );
    expect(screen.getByTestId('word-wrap').textContent).toBe('yes');
    expect(screen.getByTestId('line-numbers').textContent).toBe('no');
  });

  test('updates settings and persists to localStorage', () => {
    render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );
    const btn = screen.getByText('Toggle Wrap');
    act(() => {
      btn.click();
    });
    expect(screen.getByTestId('word-wrap').textContent).toBe('no');
    
    const saved = JSON.parse(localStorage.getItem('glade_settings') || '{}');
    expect(saved.wordWrap).toBe(false);
  });
});
