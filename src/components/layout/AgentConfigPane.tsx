import { useState, useEffect } from 'react';
import { invoke } from '../../utils/api';
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react';

export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  model_class?: string;
  tools_allowed?: string[];
  skills_allowed?: string[];
  allow_internal_knowledge_fallback?: boolean;
}

export interface ToolInfo {
  name: string;
  description: string;
}

interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

interface AgentConfigPaneProps {
  vaultPath: string;
}

export default function AgentConfigPane({ vaultPath }: AgentConfigPaneProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [vaultPath]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [agentsData, toolsData, skillsData] = await Promise.all([
        invoke<Agent[]>('get_agents', { vaultPath }),
        invoke<ToolInfo[]>('get_available_tools'),
        invoke<SkillInfo[]>('get_available_skills', { vaultPath })
      ]);
      setAgents(agentsData);
      setAvailableTools(toolsData);
      setAvailableSkills(skillsData);
      
      if (agentsData.length > 0 && !selectedAgentId) {
        handleSelectAgent(agentsData[0]);
      } else if (selectedAgentId) {
        const updated = agentsData.find(a => a.id === selectedAgentId);
        if (updated) setEditingAgent(updated);
      }
    } catch (e) {
      console.error("Failed to load agent config data", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setEditingAgent({ ...agent });
  };

  const handleCreateAgent = () => {
    const newAgent: Agent = {
      id: `agent_${Date.now()}`,
      name: 'New Agent',
      system_prompt: 'You are a helpful assistant.',
      model_class: 'fast',
      tools_allowed: [],
      skills_allowed: [],
      allow_internal_knowledge_fallback: true
    };
    setSelectedAgentId(newAgent.id);
    setEditingAgent(newAgent);
  };

  const handleSave = async () => {
    if (!editingAgent) return;
    try {
      await invoke('save_agent', { vaultPath, agent: editingAgent });
      window.dispatchEvent(new Event('agents-updated'));
      await loadData();
    } catch (e) {
      console.error("Failed to save agent", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      await invoke('delete_agent', { vaultPath, agentId: id });
      if (selectedAgentId === id) {
        setSelectedAgentId(null);
        setEditingAgent(null);
      }
      window.dispatchEvent(new Event('agents-updated'));
      await loadData();
    } catch (e) {
      console.error("Failed to delete agent", e);
    }
  };

  return (
    <div className="agent-config-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--background-modifier-border)' }}>
      <div style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--background-modifier-border)' }}>
        <h3 style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Agents Config</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="icon-btn" onClick={loadData} title="Refresh Data" disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
          <button className="icon-btn" onClick={handleCreateAgent} title="New Agent">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Agent List */}
        <div style={{ width: '150px', borderRight: '1px solid var(--background-modifier-border)', overflowY: 'auto' }}>
          {agents.map(a => (
            <div 
              key={a.id}
              className="agent-list-item"
              onClick={() => handleSelectAgent(a)}
              style={{
                padding: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                backgroundColor: selectedAgentId === a.id ? 'var(--background-modifier-active)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
              {a.id !== 'coordinator' && a.id !== 'refactor' && (
                <button 
                  className="icon-btn" 
                  onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                  style={{ opacity: selectedAgentId === a.id ? 1 : 0 }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Editor Form */}
        {editingAgent ? (
          <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-muted)' }}>Name</label>
              <input 
                className="glade-input"
                style={{ width: '100%' }}
                value={editingAgent.name}
                onChange={e => setEditingAgent({...editingAgent, name: e.target.value})}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-muted)' }}>ID</label>
              <input 
                className="glade-input"
                style={{ width: '100%' }}
                value={editingAgent.id}
                disabled
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-muted)' }}>System Prompt</label>
              <textarea 
                className="glade-input"
                style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                value={editingAgent.system_prompt}
                onChange={e => setEditingAgent({...editingAgent, system_prompt: e.target.value})}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-muted)' }}>Model Class</label>
              <select 
                className="glade-input"
                style={{ width: '100%' }}
                value={editingAgent.model_class || 'fast'}
                onChange={e => setEditingAgent({...editingAgent, model_class: e.target.value})}
              >
                <option value="fast">Fast (e.g. Gemini Flash)</option>
                <option value="reasoning">Reasoning (e.g. Gemini Pro)</option>
                <option value="large">Large (Highest capability)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-muted)' }}>Tools Allowed</label>
              <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--background-modifier-border)', padding: '4px', borderRadius: '4px' }}>
                {availableTools.map(tool => {
                  const isChecked = editingAgent.tools_allowed?.includes(tool.name) || false;
                  return (
                    <label key={tool.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid var(--background-modifier-border)' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        style={{ marginTop: '3px' }}
                        onChange={(e) => {
                          let newTools = [...(editingAgent.tools_allowed || [])];
                          if (e.target.checked) newTools.push(tool.name);
                          else newTools = newTools.filter(t => t !== tool.name);
                          setEditingAgent({...editingAgent, tools_allowed: newTools});
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{tool.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.2, marginTop: '2px' }}>{tool.description}</span>
                      </div>
                    </label>
                  );
                })}
                {availableTools.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No tools available.</span>}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-muted)' }}>Skills Allowed</label>
              <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--background-modifier-border)', padding: '4px', borderRadius: '4px' }}>
                {availableSkills.map(skill => (
                  <label key={skill.id} className="tool-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '2px 0' }}>
                    <input
                      type="checkbox"
                      checked={(editingAgent.skills_allowed || []).includes(skill.id)}
                      onChange={(e) => {
                        const current = editingAgent.skills_allowed || [];
                        const updated = e.target.checked
                          ? [...current, skill.id]
                          : current.filter(s => s !== skill.id);
                        setEditingAgent({ ...editingAgent, skills_allowed: updated });
                      }}
                    />
                    <div className="tool-info" style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="tool-name" style={{ fontWeight: 500 }}>{skill.name}</span>
                      <span className="tool-description" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{skill.description}</span>
                    </div>
                  </label>
                ))}
                {availableSkills.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No skills found. Ensure directories with SKILL.md exist in .agents/skills/</span>}
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={editingAgent.allow_internal_knowledge_fallback !== false}
                  onChange={e => setEditingAgent({...editingAgent, allow_internal_knowledge_fallback: e.target.checked})}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 500 }}>Allow Internal Knowledge Fallback</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>If enabled, the agent can use its pre-trained knowledge if no external search tools are provided.</span>
                </div>
              </label>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="icon-btn" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--interactive-accent)', color: 'white' }}>
                <Save size={14} />
                <span style={{ fontSize: '13px' }}>Save</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Select an agent to edit
          </div>
        )}
      </div>
    </div>
  );
}
