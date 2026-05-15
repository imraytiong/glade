import { useState, useEffect } from 'react';
import { load } from '../../utils/store';
import { Check, X, Loader2, Key } from 'lucide-react';

export default function ModelsPanel() {
  const [apiKey, setApiKey] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  // Specific model roles
  const [modelLite, setModelLite] = useState('');
  const [modelFast, setModelFast] = useState('');
  const [modelThinking, setModelThinking] = useState('');

  const [availableModels, setAvailableModels] = useState<{name: string, displayName: string}[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    load('settings.json').then(store => {
      store.get<string>('gemini_api_key').then(val => {
        if (val) {
          setApiKey(val);
          fetchModels(val);
        }
      });
      store.get<string>('gemini_lite_model').then(val => {
        if (val) setModelLite(val);
      });
      store.get<string>('gemini_fast_model').then(val => {
        if (val) setModelFast(val);
      });
      store.get<string>('gemini_thinking_model').then(val => {
        if (val) setModelThinking(val);
      });
    });
  }, []);

  const fetchModels = async (key: string) => {
    if (!key) return;
    setIsLoadingModels(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (res.ok) {
        setTestStatus('success');
        const data = await res.json();
        const models = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({
            name: m.name.replace('models/', ''),
            displayName: m.displayName || m.name
          }));
        setAvailableModels(models);
        
        if (models.length > 0) {
            const store = await load('settings.json');
            
            const savedLite = await store.get<string>('gemini_lite_model');
            if (!savedLite) {
                const flash8b = models.filter((m: any) => m.name.includes('flash-8b')).sort((a: any, b: any) => b.name.localeCompare(a.name));
                const defaultLite = flash8b.length > 0 ? flash8b[0].name : models[0].name;
                setModelLite(defaultLite);
                await store.set('gemini_lite_model', defaultLite);
            }

            const savedFast = await store.get<string>('gemini_fast_model');
            if (!savedFast) {
                const flashModels = models.filter((m: any) => m.name.includes('flash') && !m.name.includes('8b')).sort((a: any, b: any) => b.name.localeCompare(a.name));
                const defaultFast = flashModels.length > 0 ? flashModels[0].name : models[0].name;
                setModelFast(defaultFast);
                await store.set('gemini_fast_model', defaultFast);
            }

            const savedThinking = await store.get<string>('gemini_thinking_model');
            if (!savedThinking) {
                const proModels = models.filter((m: any) => m.name.includes('pro') || m.name.includes('thinking')).sort((a: any, b: any) => b.name.localeCompare(a.name));
                const defaultThinking = proModels.length > 0 ? proModels[0].name : models[0].name;
                setModelThinking(defaultThinking);
                await store.set('gemini_thinking_model', defaultThinking);
            }
            await store.save();
        }
      } else {
          setTestStatus('failed');
      }
    } catch (err) {
      console.error("Failed to fetch models", err);
      setTestStatus('failed');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSaveApiKey = async (val: string) => {
    setApiKey(val);
    const store = await load('settings.json');
    await store.set('gemini_api_key', val);
    await store.save();
    setTestStatus('idle'); // reset test status on change
  };

  const handleTestKey = () => {
      setTestStatus('testing');
      fetchModels(apiKey);
  };

  const handleSaveModelLite = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setModelLite(val);
    const store = await load('settings.json');
    await store.set('gemini_lite_model', val);
    await store.save();
  };

  const handleSaveModelFast = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setModelFast(val);
    const store = await load('settings.json');
    await store.set('gemini_fast_model', val);
    await store.save();
  };

  const handleSaveModelThinking = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setModelThinking(val);
    const store = await load('settings.json');
    await store.set('gemini_thinking_model', val);
    await store.save();
  };

  const renderMaskedKey = () => {
      if (!apiKey) return "No API key configured";
      if (apiKey.length <= 8) return apiKey;
      const first4 = apiKey.substring(0, 4);
      const last4 = apiKey.substring(apiKey.length - 4);
      return `${first4}${'•'.repeat(16)}${last4}`;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--background-modifier-border)",
        }}
      >
        <div style={{ display: "flex", gap: "16px", alignItems: "baseline" }}>
          <h1
            style={{ margin: 0, fontSize: "20px", color: "var(--text-normal)" }}
          >
            Models
          </h1>
        </div>
      </div>
      
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--background-primary)', color: 'var(--text-normal)' }}>
        <section style={{ maxWidth: '600px' }}>
          
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500 }}>
              Gemini API Key
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {testStatus === 'testing' && <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Loader2 size={12} className="spin" /> Testing...</span>}
              {testStatus === 'success' && <span style={{ fontSize: '12px', color: 'var(--text-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> Key is valid</span>}
              {testStatus === 'failed' && <span style={{ fontSize: '12px', color: 'var(--text-error)', display: 'flex', alignItems: 'center', gap: '4px' }}><X size={12} /> Invalid key</span>}
              
              <button 
                  onClick={handleTestKey}
                  disabled={!apiKey || testStatus === 'testing'}
                  style={{
                      background: 'var(--interactive-normal)',
                      color: 'var(--text-normal)',
                      border: '1px solid var(--background-modifier-border)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: !apiKey || testStatus === 'testing' ? 'not-allowed' : 'pointer',
                      opacity: !apiKey || testStatus === 'testing' ? 0.5 : 1
                  }}
              >
                  Test Key
              </button>
            </div>
          </div>
          
          {isEditingKey ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={apiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    style={{ 
                      flex: 1,
                      background: 'var(--background-secondary)', 
                      color: 'var(--text-normal)', 
                      border: '1px solid var(--interactive-accent)', 
                      padding: '10px 14px', 
                      borderRadius: '6px',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                    onBlur={() => setIsEditingKey(false)}
                  />
                  <button 
                      onClick={() => setIsEditingKey(false)}
                      style={{
                          background: 'var(--interactive-accent)',
                          color: 'white',
                          border: 'none',
                          padding: '0 16px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 500
                      }}
                  >
                      Done
                  </button>
              </div>
          ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                  <div 
                      style={{ 
                          flex: 1,
                          background: 'var(--background-secondary)', 
                          color: apiKey ? 'var(--text-normal)' : 'var(--text-muted)', 
                          border: '1px solid var(--background-modifier-border)', 
                          padding: '10px 14px', 
                          borderRadius: '6px',
                          boxSizing: 'border-box',
                          fontFamily: 'monospace',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                      }}
                  >
                      <Key size={16} style={{ opacity: 0.5 }} />
                      {renderMaskedKey()}
                  </div>
                  <button 
                      onClick={() => setIsEditingKey(true)}
                      style={{
                          background: 'var(--interactive-normal)',
                          color: 'var(--text-normal)',
                          border: '1px solid var(--background-modifier-border)',
                          padding: '0 16px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 500
                      }}
                  >
                      Edit
                  </button>
              </div>
          )}
          
          <p style={{ fontSize: '13px', color: 'var(--text-faint)', marginTop: '8px' }}>
            Your API key is securely stored in your local operating system keyring via Tauri.
          </p>
        </div>
        
        <h3 style={{ fontSize: '16px', margin: '32px 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid var(--background-modifier-border)' }}>
            Role-Based Model Assignment
        </h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>
            Lite Model
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Used for rapid, simple tasks like title generation and summarization.</p>
          <select 
            value={modelLite}
            onChange={handleSaveModelLite}
            disabled={isLoadingModels || availableModels.length === 0}
            style={{ 
              width: '100%',
              background: 'var(--background-secondary)', 
              color: 'var(--text-normal)', 
              border: '1px solid var(--background-modifier-border)', 
              padding: '10px 14px', 
              borderRadius: '6px',
              cursor: availableModels.length > 0 ? 'pointer' : 'not-allowed',
              boxSizing: 'border-box'
            }}
          >
            {availableModels.length === 0 ? (
              <option value={modelLite}>{isLoadingModels ? "Loading models..." : modelLite || 'Enter API key to load models'}</option>
            ) : (
              availableModels.map(m => (
                <option key={m.name} value={m.name}>{m.displayName}</option>
              ))
            )}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>
            Fast Model
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Used for standard interactions and conversational tasks.</p>
          <select 
            value={modelFast}
            onChange={handleSaveModelFast}
            disabled={isLoadingModels || availableModels.length === 0}
            style={{ 
              width: '100%',
              background: 'var(--background-secondary)', 
              color: 'var(--text-normal)', 
              border: '1px solid var(--background-modifier-border)', 
              padding: '10px 14px', 
              borderRadius: '6px',
              cursor: availableModels.length > 0 ? 'pointer' : 'not-allowed',
              boxSizing: 'border-box'
            }}
          >
            {availableModels.length === 0 ? (
              <option value={modelFast}>{isLoadingModels ? "Loading models..." : modelFast || 'Enter API key to load models'}</option>
            ) : (
              availableModels.map(m => (
                <option key={m.name} value={m.name}>{m.displayName}</option>
              ))
            )}
          </select>
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', fontWeight: 500 }}>
            Thinking Model
          </label>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Used for complex reasoning, tool execution, and multistep planning.</p>
          <select 
            value={modelThinking}
            onChange={handleSaveModelThinking}
            disabled={isLoadingModels || availableModels.length === 0}
            style={{ 
              width: '100%',
              background: 'var(--background-secondary)', 
              color: 'var(--text-normal)', 
              border: '1px solid var(--background-modifier-border)', 
              padding: '10px 14px', 
              borderRadius: '6px',
              cursor: availableModels.length > 0 ? 'pointer' : 'not-allowed',
              boxSizing: 'border-box'
            }}
          >
            {availableModels.length === 0 ? (
              <option value={modelThinking}>{isLoadingModels ? "Loading models..." : modelThinking || 'Enter API key to load models'}</option>
            ) : (
              availableModels.map(m => (
                <option key={m.name} value={m.name}>{m.displayName}</option>
              ))
            )}
          </select>
          {availableModels.length === 0 && !isLoadingModels && apiKey && (
            <p style={{ fontSize: '13px', color: 'var(--text-error)', marginTop: '8px' }}>
              Failed to load models. Check your API key.
            </p>
          )}
        </div>

      </section>
      </div>
    </div>
  );
}
