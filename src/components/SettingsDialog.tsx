import { useState } from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../utils/settings';
import { invoke } from '@tauri-apps/api/core';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vaultPath: string | null;
}

export default function SettingsDialog({ isOpen, onClose, vaultPath }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general');
  const [isBuildingIndex, setIsBuildingIndex] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        backgroundColor: 'var(--background-primary)',
        borderRadius: '8px',
        width: '500px',
        maxWidth: '90%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid var(--background-modifier-border)',
        color: 'var(--text-normal)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--background-modifier-border)' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 600 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--background-modifier-border)' }}>
          <button 
            onClick={() => setActiveTab('general')}
            style={{ 
              flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === 'general' ? 'var(--text-normal)' : 'var(--text-muted)',
              borderBottom: activeTab === 'general' ? '2px solid var(--interactive-accent)' : '2px solid transparent',
              fontWeight: activeTab === 'general' ? 600 : 400
            }}
          >
            General
          </button>
          <button 
            onClick={() => setActiveTab('advanced')}
            style={{ 
              flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === 'advanced' ? 'var(--text-normal)' : 'var(--text-muted)',
              borderBottom: activeTab === 'advanced' ? '2px solid var(--interactive-accent)' : '2px solid transparent',
              fontWeight: activeTab === 'advanced' ? 600 : 400
            }}
          >
            Advanced
          </button>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto' }}>
          {activeTab === 'general' && (
            <>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px' }}>Theme</span>
                <select 
                  value={settings.theme} 
                  onChange={e => updateSettings({ theme: e.target.value as any })}
                  style={{ background: 'var(--background-secondary)', color: 'var(--text-normal)', border: '1px solid var(--background-modifier-border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <option value="system">System Default</option>
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px' }}>Font Style</span>
                <select 
                  value={settings.fontFamily} 
                  onChange={e => updateSettings({ fontFamily: e.target.value as any })}
                  style={{ background: 'var(--background-secondary)', color: 'var(--text-normal)', border: '1px solid var(--background-modifier-border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <option value="sans">Sans-Serif</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Monospace</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px' }}>Show Backlinks Pane</span>
                <input 
                  type="checkbox" 
                  checked={settings.showBacklinks} 
                  onChange={e => updateSettings({ showBacklinks: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px' }}>Line Numbers</span>
                <input 
                  type="checkbox" 
                  checked={settings.lineNumbers} 
                  onChange={e => updateSettings({ lineNumbers: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px' }}>Word Wrap</span>
                <input 
                  type="checkbox" 
                  checked={settings.wordWrap} 
                  onChange={e => updateSettings({ wordWrap: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', display: 'flex', flexDirection: 'column' }}>
                  Focus / Typewriter Mode
                  <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Keep cursor in the center of the screen</span>
                </span>
                <input 
                  type="checkbox" 
                  checked={settings.typewriterMode} 
                  onChange={e => updateSettings({ typewriterMode: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            </>
          )}
          {activeTab === 'advanced' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Semantic Search Index</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Build a local vector index of your vault for AI-powered semantic search. This may take a few minutes for large vaults.
                </p>
                <button 
                  className="btn primary"
                  disabled={isBuildingIndex || !vaultPath}
                  onClick={async () => {
                    if (!vaultPath) return;
                    setIsBuildingIndex(true);
                    try {
                      await invoke("build_index", { vaultPath });
                      alert("Semantic index built successfully!");
                    } catch (e) {
                      console.error("Failed to build index", e);
                      alert("Failed to build index: " + e);
                    } finally {
                      setIsBuildingIndex(false);
                    }
                  }}
                  style={{ width: '100%', padding: '8px', cursor: isBuildingIndex ? 'not-allowed' : 'pointer', opacity: isBuildingIndex ? 0.7 : 1 }}
                >
                  {isBuildingIndex ? "Building Index..." : "Build Vault Index"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
