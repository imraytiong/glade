import { useState, useEffect } from 'react';
import { readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { Agent } from '../../types/agent';

export default function AgentConfigPane({ vaultPath }: { vaultPath: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Agent>>({});
  const [loading, setLoading] = useState(true);

  const agentsPath = `${vaultPath}/.glade/agents.json`;
  const gladeDirPath = `${vaultPath}/.glade`;

  useEffect(() => {
    loadAgents();
  }, [vaultPath]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const content = await readTextFile(agentsPath);
      const parsed = JSON.parse(content);
      setAgents(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      // If file doesn't exist, create defaults
      const defaultAgents: Agent[] = [
        {
          id: "coordinator",
          name: "Coordinator",
          system_prompt: "You are the Glade Coordinator Agent. You help users manage their personal knowledge base. Use the provided active file context to answer questions accurately. Do not make up information.",
          model_class: "fast"
        },
        {
          id: "refactor",
          name: "Refactor",
          system_prompt: "You are an expert editor. You rewrite the user's provided text according to their prompt. Return ONLY the rewritten valid Markdown. Do not include introductory or conversational text like 'Here is the rewritten text:'.",
          model_class: "fast"
        }
      ];
      try {
        await mkdir(gladeDirPath, { recursive: true });
        await writeTextFile(agentsPath, JSON.stringify(defaultAgents, null, 2));
        setAgents(defaultAgents);
      } catch (writeErr) {
        console.error("Failed to initialize default agents", writeErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveAgents = async (newAgents: Agent[]) => {
    try {
      await writeTextFile(agentsPath, JSON.stringify(newAgents, null, 2));
      setAgents(newAgents);
    } catch (err) {
      console.error("Failed to save agents", err);
    }
  };

  const handleAddAgent = () => {
    const newId = `agent-${Date.now()}`;
    const newAgent: Agent = {
      id: newId,
      name: "New Agent",
      system_prompt: "You are a helpful assistant.",
      model_class: "fast"
    };
    const newAgents = [...agents, newAgent];
    saveAgents(newAgents);
    handleEditStart(newAgent);
  };

  const handleDeleteAgent = (id: string) => {
    const newAgents = agents.filter(a => a.id !== id);
    saveAgents(newAgents);
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const handleEditStart = (agent: Agent) => {
    setEditingId(agent.id);
    setEditForm({ ...agent });
  };

  const handleEditSave = () => {
    if (!editingId) return;
    const newAgents = agents.map(a => {
      if (a.id === editingId) {
        return { ...a, ...editForm } as Agent;
      }
      return a;
    });
    saveAgents(newAgents);
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  if (loading) {
    return <div style={{ padding: '16px', color: 'var(--text-faint)' }}>Loading agents...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--background-modifier-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Custom Agents</h3>
        <button className="icon-btn" onClick={handleAddAgent} title="New Agent">
          <Plus size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {agents.map(agent => (
          <div key={agent.id} style={{ 
            marginBottom: '8px', 
            background: 'var(--background-secondary)', 
            borderRadius: '6px',
            border: editingId === agent.id ? '1px solid var(--text-accent)' : '1px solid transparent',
            overflow: 'hidden'
          }}>
            {editingId === agent.id ? (
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Name</label>
                  <input 
                    type="text" 
                    value={editForm.name || ''} 
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    style={{ width: '100%', background: 'var(--background-primary)', border: '1px solid var(--background-modifier-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Model Class</label>
                  <select 
                    value={editForm.model_class || 'fast'} 
                    onChange={e => setEditForm({...editForm, model_class: e.target.value})}
                    style={{ width: '100%', background: 'var(--background-primary)', border: '1px solid var(--background-modifier-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}
                  >
                    <option value="fast">Fast (e.g. Flash)</option>
                    <option value="reasoning">Reasoning (e.g. Pro)</option>
                    <option value="large">Large (e.g. Ultra)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>System Prompt</label>
                  <textarea 
                    value={editForm.system_prompt || ''} 
                    onChange={e => setEditForm({...editForm, system_prompt: e.target.value})}
                    rows={6}
                    style={{ width: '100%', background: 'var(--background-primary)', border: '1px solid var(--background-modifier-border)', color: 'var(--text-primary)', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                  <button onClick={handleEditCancel} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }} className="hover-bg">
                    <X size={12} /> Cancel
                  </button>
                  <button onClick={handleEditSave} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--text-accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '4px 8px', borderRadius: '4px', fontWeight: 500 }}>
                    <Check size={12} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div 
                style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                className="hover-bg"
                onClick={() => handleEditStart(agent)}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>{agent.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{agent.model_class}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id); }} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {agents.length === 0 && (
          <div style={{ padding: '16px', color: 'var(--text-faint)', fontSize: '13px', textAlign: 'center' }}>
            No custom agents found.
          </div>
        )}
      </div>
    </div>
  );
}
