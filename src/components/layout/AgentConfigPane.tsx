import { useState, useEffect } from 'react';
import { invoke } from '../../utils/api';
import { RefreshCw, FileText } from 'lucide-react';

export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  model_class?: string;
  tools_allowed?: string[];
  skills_allowed?: string[];
  allow_internal_knowledge_fallback?: boolean;
}

interface AgentConfigPaneProps {
  vaultPath: string;
}

export default function AgentConfigPane({ vaultPath }: AgentConfigPaneProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
    const handleAgentsUpdated = () => loadData();
    window.addEventListener('agents-updated', handleAgentsUpdated);
    return () => window.removeEventListener('agents-updated', handleAgentsUpdated);
  }, [vaultPath]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const agentsData = await invoke<Agent[]>('get_agents', { vaultPath });
      setAgents(agentsData);
    } catch (e) {
      console.error("Failed to load agent config data", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAgent = (agent: Agent) => {
    // Dispatch event to open the agent.md file in the editor
    const path = `${vaultPath}/.glade/agents/${agent.id}.agent.md`;
    window.dispatchEvent(new CustomEvent('open-file', { 
      detail: { 
        file: {
          name: `${agent.id}.agent.md`,
          path: path,
          isDirectory: false
        }
      } 
    }));
  };

  return (
    <div className="agent-config-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--background-modifier-border)' }}>
      <div style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--background-modifier-border)' }}>
        <h3 style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Agents</h3>
        <button className="icon-btn" onClick={loadData} title="Refresh Data" disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {agents.map(a => (
          <div 
            key={a.id}
            className="agent-list-item"
            onClick={() => handleSelectAgent(a)}
            style={{
              padding: '12px',
              cursor: 'pointer',
              fontSize: '13px',
              backgroundColor: 'var(--background-secondary)',
              border: '1px solid var(--background-modifier-border)',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-normal)' }}>{a.name}</span>
              <FileText size={14} color="var(--text-muted)" />
            </div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {a.model_class && (
                <span style={{ backgroundColor: 'var(--background-modifier-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                  {a.model_class}
                </span>
              )}
              {a.tools_allowed && a.tools_allowed.length > 0 && (
                <span style={{ backgroundColor: 'var(--background-modifier-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                  {a.tools_allowed.length} tools
                </span>
              )}
            </div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {a.system_prompt}
            </div>
          </div>
        ))}
        {agents.length === 0 && !isLoading && (
          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No agents found.
          </div>
        )}
      </div>
    </div>
  );
}
