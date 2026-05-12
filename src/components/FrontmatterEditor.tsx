import React, { useState, useEffect } from 'react';
import { parse, stringify } from 'yaml';
import { ChevronDown, ChevronRight, Settings, Plus, X } from 'lucide-react';

interface FrontmatterEditorProps {
  value: string | null;
  onChange: (newValue: string) => void;
}

export const FrontmatterEditor: React.FC<FrontmatterEditorProps> = ({ value, onChange }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [data, setData] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const parsed = parse(value || '');
      if (parsed && typeof parsed === 'object') {
        setData(parsed);
      } else {
        setData({});
      }
    } catch (e) {
      console.error('Failed to parse frontmatter YAML', e);
    }
  }, [value]);

  const updateLocalField = (key: string, newValue: string) => {
    setData(prev => ({ ...prev, [key]: newValue }));
  };

  const commitChanges = () => {
    try {
      const newYaml = stringify(data).trim();
      onChange(newYaml);
    } catch (e) {
      console.error('Failed to stringify frontmatter YAML', e);
    }
  };

  const updateKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || newKey.trim() === '') return;
    if (data[newKey] !== undefined) return; // prevent overwrite

    const newData: Record<string, any> = {};
    for (const k of Object.keys(data)) {
      if (k === oldKey) {
        newData[newKey] = data[oldKey];
      } else {
        newData[k] = data[k];
      }
    }
    setData(newData);
    try {
      onChange(stringify(newData).trim());
    } catch (e) {}
  };

  const addProperty = (focusTarget?: 'label' | 'value') => {
    let newKeyBase = 'new_property';
    let newKey = `${newKeyBase}_${Object.keys(data).length + 1}`;
    let counter = Object.keys(data).length + 2;
    while (data.hasOwnProperty(newKey)) {
      newKey = `${newKeyBase}_${counter}`;
      counter++;
    }
    const newData = { ...data, [newKey]: '' };
    setData(newData);
    try {
      onChange(stringify(newData).trim());
    } catch (e) {}

    if (focusTarget) {
      setTimeout(() => {
        const el = document.getElementById(`fm-${focusTarget}-${newKey}`);
        if (el) el.focus();
      }, 50);
    }
  };

  const removeProperty = (keyToRemove: string) => {
    const newData = { ...data };
    delete newData[keyToRemove];
    setData(newData);
    try {
      onChange(stringify(newData).trim());
    } catch (e) {}
  };

  return (
    <div 
      className="glade-frontmatter"
      style={{
        width: '100%',
        backgroundColor: 'transparent',
        borderBottom: '1px solid var(--background-modifier-border)',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          backgroundColor: 'var(--bg-tertiary)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          color: 'var(--text-muted)',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          userSelect: 'none'
        }}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Settings size={14} />
        <span>Properties ({Object.keys(data).length})</span>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '12px' }}>
          {Object.keys(data).length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: '13px', fontStyle: 'italic' }}>
              No properties defined.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 1fr) 1.5fr 24px', gap: '4px 8px', alignItems: 'center' }}>
              {Object.entries(data).map(([key, val], index) => {
                const keys = Object.keys(data);
                const isLast = index === keys.length - 1;
                const nextKey = isLast ? null : keys[index + 1];

                return (
                <React.Fragment key={key}>
                  <input
                    id={`fm-label-${key}`}
                    type="text"
                    defaultValue={key}
                    onBlur={(e) => updateKey(key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (isLast) {
                          addProperty('label');
                        } else if (nextKey) {
                          document.getElementById(`fm-label-${nextKey}`)?.focus();
                        }
                      }
                    }}
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      fontWeight: 500,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid transparent',
                      padding: '4px 0',
                      outline: 'none',
                      width: '100%',
                      textOverflow: 'ellipsis',
                    }}
                    onFocus={(e) => e.target.style.borderBottom = '1px solid var(--text-accent)'}
                  />
                  <input
                    id={`fm-value-${key}`}
                    key={`val-${key}`}
                    type="text"
                    value={typeof val === 'object' ? JSON.stringify(val) : (val == null ? '' : String(val))}
                    placeholder="Empty value"
                    onChange={(e) => updateLocalField(key, e.target.value)}
                    onBlur={(e) => {
                      e.target.style.borderBottom = '1px solid transparent';
                      commitChanges();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (isLast) {
                          commitChanges(); // Ensure last value is saved before adding
                          addProperty('value');
                        } else if (nextKey) {
                          document.getElementById(`fm-value-${nextKey}`)?.focus();
                        }
                      }
                    }}
                    style={{
                      border: 'none',
                      borderBottom: '1px solid transparent',
                      color: 'var(--text-normal)',
                      fontSize: '13px',
                      padding: '4px 6px',
                      outline: 'none',
                      width: '100%',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(0, 0, 0, 0.1)',
                      borderRadius: '4px',
                      textOverflow: 'ellipsis',
                    }}
                    onFocus={(e) => e.target.style.borderBottom = '1px solid var(--text-accent)'}
                  />
                  <button
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProperty(key);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-faint)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      opacity: 0.5
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                  >
                    <X size={14} />
                  </button>
                </React.Fragment>
              )})}
            </div>
          )}
          
          <button
            onClick={() => addProperty()}
            style={{
              marginTop: '12px',
              background: 'none',
              border: 'none',
              color: 'var(--text-accent)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              opacity: 0.8
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
          >
            <Plus size={14} /> Add property
          </button>
        </div>
      )}
    </div>
  );
};
