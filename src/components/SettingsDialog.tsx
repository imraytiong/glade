import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../utils/settings';
import { load } from '../utils/store';
import { invoke } from '../utils/api';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'mcp'>('general');
  const [apiKey, setApiKey] = useState('');
  const [mcpServersConfig, setMcpServersConfig] = useState('{\n  "mcpServers": {\n    \n  }\n}');
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<{name: string, displayName: string}[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    if (isOpen) {
      load('settings.json').then(store => {
        store.get<string>('gemini_api_key').then(val => {
          if (val) {
            setApiKey(val);
            fetchModels(val);
          }
        });
        store.get<string>('gemini_model').then(val => {
          if (val) setModel(val);
        });
      });
      
      const vaultPath = localStorage.getItem('glade_vault_path');
      if (vaultPath) {
          // Attempt to load mcp_servers.json from .glade folder using a Tauri command or similar...
          // For now we'll just read it using tauri fs plugin
          import('../utils/fs').then(({ readTextFile, exists }) => {
              const mcpPath = `${vaultPath}/.glade/mcp_servers.json`;
              exists(mcpPath).then((doesExist: boolean) => {
                  if (doesExist) {
                      readTextFile(mcpPath).then((content: string) => setMcpServersConfig(content)).catch(console.error);
                  }
              });
          });
      }
    }
  }, [isOpen]);

  const fetchModels = async (key: string) => {
    if (!key) return;
    setIsLoadingModels(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (res.ok) {
        const data = await res.json();
        const models = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({
            name: m.name.replace('models/', ''),
            displayName: m.displayName || m.name
          }));
        setAvailableModels(models);
        
        // Auto-select latest fast model if none explicitly selected by user before
        if (models.length > 0) {
            const store = await load('settings.json');
            const savedModel = await store.get<string>('gemini_model');
            if (!savedModel) {
                // Find a flash model, sort descending so e.g. 2.5 comes before 1.5
                const flashModels = models.filter((m: any) => m.name.includes('flash')).sort((a: any, b: any) => b.name.localeCompare(a.name));
                const defaultModel = flashModels.length > 0 ? flashModels[0].name : models[0].name;
                setModel(defaultModel);
                await store.set('gemini_model', defaultModel);
                await store.save();
            }
        }
      }
    } catch (err) {
      console.error("Failed to fetch models", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSaveApiKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    const store = await load('settings.json');
    await store.set('gemini_api_key', val);
    await store.save();
    
    // Attempt to fetch models using the new key
    if (val.length > 20) {
        fetchModels(val);
    }
  };

  const handleSaveModel = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setModel(val);
    const store = await load('settings.json');
    await store.set('gemini_model', val);
    await store.save();
  };

  const handleSaveMcpConfig = async () => {
    const vaultPath = localStorage.getItem('glade_vault_path');
    if (!vaultPath) return;
    
    try {
        const { writeTextFile } = await import('../utils/fs');
        await writeTextFile(`${vaultPath}/.glade/mcp_servers.json`, mcpServersConfig);
        await invoke('reload_mcp_servers', { vaultPath });
        alert("MCP Configuration saved! The backend has reloaded the MCP servers.");
    } catch (err) {
        console.error("Failed to save MCP config", err);
        alert("Failed to save MCP config");
    }
  };

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
            onClick={() => setActiveTab('ai')}
            style={{ 
              flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === 'ai' ? 'var(--text-normal)' : 'var(--text-muted)',
              borderBottom: activeTab === 'ai' ? '2px solid var(--interactive-accent)' : '2px solid transparent',
              fontWeight: activeTab === 'ai' ? 600 : 400
            }}
          >
            AI & Agents
          </button>
          <button 
            onClick={() => setActiveTab('mcp')}
            style={{ 
              flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === 'mcp' ? 'var(--text-normal)' : 'var(--text-muted)',
              borderBottom: activeTab === 'mcp' ? '2px solid var(--interactive-accent)' : '2px solid transparent',
              fontWeight: activeTab === 'mcp' ? 600 : 400
            }}
          >
            MCP Servers
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

          {activeTab === 'ai' && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>
                  Gemini API Key
                </label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={handleSaveApiKey}
                  placeholder="AIzaSy..."
                  style={{ 
                    width: '100%',
                    background: 'var(--background-secondary)', 
                    color: 'var(--text-normal)', 
                    border: '1px solid var(--background-modifier-border)', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    boxSizing: 'border-box'
                  }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '8px' }}>
                  Your API key is securely stored in your local operating system keyring via Tauri.
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>
                  Model
                </label>
                <select 
                  value={model}
                  onChange={handleSaveModel}
                  disabled={isLoadingModels || availableModels.length === 0}
                  style={{ 
                    width: '100%',
                    background: 'var(--background-secondary)', 
                    color: 'var(--text-normal)', 
                    border: '1px solid var(--background-modifier-border)', 
                    padding: '8px 12px', 
                    borderRadius: '4px',
                    cursor: availableModels.length > 0 ? 'pointer' : 'not-allowed',
                    boxSizing: 'border-box'
                  }}
                >
                  {availableModels.length === 0 ? (
                    <option value={model}>{isLoadingModels ? "Loading models..." : model}</option>
                  ) : (
                    availableModels.map(m => (
                      <option key={m.name} value={m.name}>{m.displayName}</option>
                    ))
                  )}
                </select>
                {availableModels.length === 0 && !isLoadingModels && apiKey && (
                  <p style={{ fontSize: '12px', color: 'var(--text-error)', marginTop: '8px' }}>
                    Failed to load models. Check your API key.
                  </p>
                )}
              </div>
            </>
          )}

          {activeTab === 'mcp' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <p style={{ fontSize: '14px', marginBottom: '12px' }}>
                    Configure local MCP servers in Claude Desktop format. They will be spawned to provide extra tools to the agents.
                </p>
                <textarea 
                    value={mcpServersConfig}
                    onChange={(e) => setMcpServersConfig(e.target.value)}
                    style={{
                        width: '100%',
                        minHeight: '250px',
                        background: 'var(--background-secondary)',
                        color: 'var(--text-normal)',
                        border: '1px solid var(--background-modifier-border)',
                        padding: '12px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        resize: 'vertical',
                        marginBottom: '16px'
                    }}
                    spellCheck={false}
                />
                <button 
                    onClick={handleSaveMcpConfig}
                    style={{
                        background: 'var(--interactive-accent)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        alignSelf: 'flex-end'
                    }}
                >
                    Save MCP Configuration
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
