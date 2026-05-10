import React, { useState } from 'react';

interface ConfirmDeleteModalProps {
  fileName: string;
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ fileName, onConfirm, onCancel }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <div className="modal-overlay" onClick={onCancel} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{
        background: 'var(--background-primary)',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        fontFamily: 'var(--font-text)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--text-normal)' }}>Delete File</h2>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)' }}>
          Are you sure you want to delete <strong>{fileName}</strong>? This action cannot be undone.
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '8px' }}>
          <input 
            type="checkbox" 
            id="dontShowAgain" 
            checked={dontShowAgain} 
            onChange={(e) => setDontShowAgain(e.target.checked)} 
            style={{ accentColor: 'var(--interactive-accent)' }}
          />
          <label htmlFor="dontShowAgain" style={{ color: 'var(--text-normal)', fontSize: '0.9rem', cursor: 'pointer' }}>
            Don't ask me again
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--background-modifier-border)',
              borderRadius: '4px',
              color: 'var(--text-normal)',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(dontShowAgain)}
            style={{
              padding: '8px 16px',
              background: 'var(--interactive-accent)',
              border: 'none',
              borderRadius: '4px',
              color: '#000',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
