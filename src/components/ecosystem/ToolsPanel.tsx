import { useState, useEffect } from 'react';
import { invoke } from '../../utils/api';
import { Trash2, Save, Wrench, Code, ArrowRight } from 'lucide-react';

interface McpServerDef {
    command: string;
    args: string[];
    env: Record<string, string>;
}

interface LocalToolDef {
    code: string;
}

export default function ToolsPanel() {
  // Structured State
  const [mcpServers, setMcpServers] = useState<Record<string, McpServerDef>>({});
  const [localTools, setLocalTools] = useState<Record<string, LocalToolDef>>({});
  
  // Selection State
  const [selectedTool, setSelectedTool] = useState<{ id: string, type: 'mcp' | 'local' } | null>(null);
  
  // Editor State
  const [editName, setEditName] = useState('');
  const [editCommand, setEditCommand] = useState('');
  const [editArgs, setEditArgs] = useState('');
  const [editEnv, setEditEnv] = useState('');
  const [editCode, setEditCode] = useState('');

  // Dropdown state for Add Tool
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (vaultPath) {
        import('../../utils/fs').then(({ readTextFile, exists }) => {
            // Load MCP Servers
            const mcpPath = `${vaultPath}/.glade/mcp_servers.json`;
            exists(mcpPath).then((doesExist: boolean) => {
                if (doesExist) {
                    readTextFile(mcpPath).then((content: string) => {
                        try {
                            const parsed = JSON.parse(content);
                            if (parsed.mcpServers) setMcpServers(parsed.mcpServers);
                        } catch (e) {
                            console.error("Failed to parse mcp_servers.json", e);
                        }
                    }).catch(console.error);
                }
            });

            // Load Local Tools
            const localPath = `${vaultPath}/.glade/local_tools.json`;
            exists(localPath).then((doesExist: boolean) => {
                if (doesExist) {
                    readTextFile(localPath).then((content: string) => {
                        try {
                            const parsed = JSON.parse(content);
                            if (parsed.localTools) setLocalTools(parsed.localTools);
                        } catch (e) {
                            console.error("Failed to parse local_tools.json", e);
                        }
                    }).catch(console.error);
                }
            });
        });
    }
  }, []);

  const handleSaveMcpServers = async (newServersState: Record<string, McpServerDef>) => {
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (!vaultPath) return;
    
    const jsonStr = JSON.stringify({ mcpServers: newServersState }, null, 2);
    try {
        const { writeTextFile } = await import('../../utils/fs');
        await writeTextFile(`${vaultPath}/.glade/mcp_servers.json`, jsonStr);
        await invoke('reload_mcp_servers', { vaultPath });
    } catch (err) {
        console.error("Failed to save MCP config", err);
    }
  };

  const handleSaveLocalTools = async (newToolsState: Record<string, LocalToolDef>) => {
    const vaultPath = localStorage.getItem('glade_vaultPath');
    if (!vaultPath) return;
    
    const jsonStr = JSON.stringify({ localTools: newToolsState }, null, 2);
    try {
        const { writeTextFile } = await import('../../utils/fs');
        await writeTextFile(`${vaultPath}/.glade/local_tools.json`, jsonStr);
    } catch (err) {
        console.error("Failed to save Local Tools config", err);
    }
  };

  const selectTool = (id: string, type: 'mcp' | 'local') => {
      setSelectedTool({ id, type });
      setEditName(id);
      
      if (type === 'mcp') {
          const s = mcpServers[id];
          setEditCommand(s?.command || '');
          setEditArgs((s?.args || []).join('\n'));
          setEditEnv(Object.entries(s?.env || {}).map(([k,v]) => `${k}=${v}`).join('\n'));
      } else {
          const t = localTools[id];
          setEditCode(t?.code || '');
      }
  };

  const addNewMcpServer = () => {
      setSelectedTool({ id: '', type: 'mcp' });
      setEditName('');
      setEditCommand('');
      setEditArgs('');
      setEditEnv('');
      setShowAddMenu(false);
  };

  const addNewLocalTool = () => {
      setSelectedTool({ id: '', type: 'local' });
      setEditName('');
      setEditCode('');
      setShowAddMenu(false);
  };

  const saveCurrentTool = () => {
      if (!selectedTool) return;
      
      if (!editName.trim()) {
          alert("Tool name is required.");
          return;
      }

      if (selectedTool.type === 'mcp') {
          if (!editCommand.trim()) {
              alert("Command is required.");
              return;
          }
          const newArgs = editArgs.split('\n').map(s => s.trim()).filter(s => s.length > 0);
          const newEnv: Record<string, string> = {};
          editEnv.split('\n').forEach(line => {
              const parts = line.split('=');
              if (parts.length >= 2) {
                  const k = parts[0].trim();
                  const v = parts.slice(1).join('=').trim();
                  if (k) newEnv[k] = v;
              }
          });

          const newServerDef: McpServerDef = { command: editCommand.trim(), args: newArgs, env: newEnv };
          const updatedServers = { ...mcpServers };
          if (selectedTool.id && selectedTool.id !== editName) delete updatedServers[selectedTool.id];
          updatedServers[editName.trim()] = newServerDef;
          setMcpServers(updatedServers);
          handleSaveMcpServers(updatedServers);
          setSelectedTool({ id: editName.trim(), type: 'mcp' });
      } else {
          const newToolDef: LocalToolDef = { code: editCode };
          const updatedTools = { ...localTools };
          if (selectedTool.id && selectedTool.id !== editName) delete updatedTools[selectedTool.id];
          updatedTools[editName.trim()] = newToolDef;
          setLocalTools(updatedTools);
          handleSaveLocalTools(updatedTools);
          setSelectedTool({ id: editName.trim(), type: 'local' });
      }
  };

  const deleteTool = (id: string, type: 'mcp' | 'local', e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete the ${type === 'mcp' ? 'MCP Server' : 'Local Tool'} '${id}'?`)) {
          if (type === 'mcp') {
              const updated = { ...mcpServers };
              delete updated[id];
              setMcpServers(updated);
              handleSaveMcpServers(updated);
          } else {
              const updated = { ...localTools };
              delete updated[id];
              setLocalTools(updated);
              handleSaveLocalTools(updated);
          }
          if (selectedTool?.id === id) {
              setSelectedTool(null);
          }
      }
  };

  const mcpList = Object.keys(mcpServers);
  const localList = Object.keys(localTools);

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
            Tools
          </h1>
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Master List */}
        <div style={{ 
            width: '280px', 
            borderRight: '1px solid var(--background-modifier-border)', 
            display: 'flex', 
            flexDirection: 'column',
            background: 'var(--background-secondary)'
        }}>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {mcpList.length === 0 && localList.length === 0 && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No tools configured. Click "Add Tool" to get started.
                    </div>
                )}
                
                {mcpList.map(id => (
                    <div 
                        key={`mcp-${id}`}
                        onClick={() => selectTool(id, 'mcp')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            marginBottom: '4px',
                            background: selectedTool?.id === id && selectedTool?.type === 'mcp' ? 'var(--background-modifier-hover)' : 'transparent'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <Wrench size={14} style={{ color: 'var(--interactive-accent)', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{id}</span>
                        </div>
                        <button 
                            onClick={(e) => deleteTool(id, 'mcp', e)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}

                {localList.map(id => (
                    <div 
                        key={`local-${id}`}
                        onClick={() => selectTool(id, 'local')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            marginBottom: '4px',
                            background: selectedTool?.id === id && selectedTool?.type === 'local' ? 'var(--background-modifier-hover)' : 'transparent'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <Code size={14} style={{ color: 'var(--text-success)', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{id}</span>
                        </div>
                        <button 
                            onClick={(e) => deleteTool(id, 'local', e)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--background-modifier-border)', position: 'relative' }}>
                {showAddMenu && (
                    <div style={{ 
                        position: 'absolute', 
                        bottom: '100%', 
                        left: '16px', 
                        right: '16px', 
                        marginBottom: '4px',
                        background: 'var(--background-primary)', 
                        border: '1px solid var(--background-modifier-border)', 
                        borderRadius: '6px', 
                        boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                        zIndex: 10
                    }}>
                        <button 
                            onClick={addNewMcpServer}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', width: '100%', border: 'none', background: 'transparent', color: 'var(--text-normal)', cursor: 'pointer', borderBottom: '1px solid var(--background-modifier-border)', textAlign: 'left' }}
                        >
                            <Wrench size={14} /> Add MCP Server
                        </button>
                        <button 
                            onClick={addNewLocalTool}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', width: '100%', border: 'none', background: 'transparent', color: 'var(--text-normal)', cursor: 'pointer', textAlign: 'left' }}
                        >
                            <Code size={14} /> Add Local Tool
                        </button>
                    </div>
                )}
                <button 
                    className="btn"
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    + Create New Tool
                </button>
            </div>
        </div>

        {/* Right Detail View */}
        <div style={{ flex: 1, background: 'var(--background-primary)', overflowY: 'auto' }}>
            {!selectedTool ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <ArrowRight size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <p>Select a tool from the sidebar or create a new one.</p>
                </div>
            ) : (
                <div style={{ padding: '32px', maxWidth: '800px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        {selectedTool.type === 'mcp' ? <Wrench size={20} style={{ color: 'var(--interactive-accent)' }} /> : <Code size={20} style={{ color: 'var(--text-success)' }} />}
                        <h2 style={{ margin: 0, fontSize: '20px' }}>
                            {selectedTool.id ? `Edit ${selectedTool.type === 'mcp' ? 'MCP Server' : 'Local Tool'}: ${selectedTool.id}` : `New ${selectedTool.type === 'mcp' ? 'MCP Server' : 'Local Tool'}`}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Tool Name</label>
                            <input 
                                type="text" 
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                placeholder="e.g. my-tool"
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)', background: 'var(--background-primary)', color: 'var(--text-normal)' }}
                            />
                        </div>

                        {selectedTool.type === 'mcp' ? (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Command</label>
                                    <input 
                                        type="text" 
                                        value={editCommand}
                                        onChange={e => setEditCommand(e.target.value)}
                                        placeholder="e.g. npx, python, node"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)', background: 'var(--background-primary)', color: 'var(--text-normal)' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Arguments (One per line)</label>
                                    <textarea 
                                        value={editArgs}
                                        onChange={e => setEditArgs(e.target.value)}
                                        placeholder="-y\n@modelcontextprotocol/server-everything"
                                        rows={4}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)', background: 'var(--background-primary)', color: 'var(--text-normal)', resize: 'vertical', fontFamily: 'monospace' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Environment Variables (KEY=value per line)</label>
                                    <textarea 
                                        value={editEnv}
                                        onChange={e => setEditEnv(e.target.value)}
                                        placeholder="API_KEY=your_key_here\nDEBUG=true"
                                        rows={4}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)', background: 'var(--background-primary)', color: 'var(--text-normal)', resize: 'vertical', fontFamily: 'monospace' }}
                                    />
                                </div>
                            </>
                        ) : (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}>Tool Code (TypeScript/Python)</label>
                                <textarea 
                                    value={editCode}
                                    onChange={e => setEditCode(e.target.value)}
                                    placeholder="export function myTool() { return 'hello'; }"
                                    rows={20}
                                    style={{ width: '100%', padding: '16px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)', background: 'var(--background-secondary)', color: 'var(--text-normal)', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                                    spellCheck={false}
                                />
                            </div>
                        )}

                        <div style={{ marginTop: '8px' }}>
                            <button onClick={saveCurrentTool} style={{ background: 'var(--interactive-accent)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Save size={16} /> Save {selectedTool.type === 'mcp' ? 'Server' : 'Tool'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
