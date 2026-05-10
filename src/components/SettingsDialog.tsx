import { X } from 'lucide-react';
import { useSettings } from '../utils/settings';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();

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
        width: '400px',
        maxWidth: '90%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid var(--background-modifier-border)',
        color: 'var(--text-normal)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--background-modifier-border)' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 600 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '16px' }}>
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
        </div>
      </div>
    </div>
  );
}
