import { useState, useRef, useEffect } from 'react';
import { invoke } from '../../utils/api';
import { listen } from '../../utils/api';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import { useError } from '../../contexts/ErrorContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './AgentSidebar.css';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  pendingApproval?: { id: string, tool_name: string, args: any };
}

import { Agent } from '../../types/agent';

interface AgentSidebarProps {
  activeFileContent: { path: string, content: string } | null;
  vaultPath: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  activeAgentChatId: string;
  setActiveAgentChatId: React.Dispatch<React.SetStateAction<string>>;
}

export default function AgentSidebar({ activeFileContent, vaultPath, messages, setMessages, activeAgentChatId, setActiveAgentChatId }: AgentSidebarProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showError } = useError();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!vaultPath) return;
    const loadAgents = async () => {
      try {
        const fetchedAgents = await invoke<Agent[]>('get_agents', { vaultPath });
        if (Array.isArray(fetchedAgents) && fetchedAgents.length > 0) {
          setAgents(fetchedAgents);
          // If the previously selected agent doesn't exist anymore, reset it
          setAgents((currentAgents) => {
             if (!currentAgents.find((a: Agent) => a.id === activeAgentChatId)) {
                setActiveAgentChatId(fetchedAgents[0].id);
             }
             return fetchedAgents;
          });
        }
      } catch (err) {
        console.error("Failed to load agents in sidebar", err);
      }
    };
    loadAgents();

    const handleAgentsUpdated = () => {
      loadAgents();
    };
    window.addEventListener('agents-updated', handleAgentsUpdated);
    return () => window.removeEventListener('agents-updated', handleAgentsUpdated);
  }, [vaultPath, activeAgentChatId, setActiveAgentChatId]);

  useEffect(() => {
    if (!vaultPath || !activeAgentChatId) return;
    const loadThread = async () => {
      try {
        const loadedMessages = await invoke<Message[]>('load_thread', { vaultPath, threadId: `agent_${activeAgentChatId}` });
        setMessages(loadedMessages || []);
      } catch (err) {
        console.error("Failed to load thread", err);
      }
    };
    loadThread();
  }, [vaultPath, activeAgentChatId, setMessages]);

  useEffect(() => {
    const unlisten = listen('glade://agent-trace', (event: any) => {
      const payload = event.payload;
      if (typeof payload === 'object' && payload !== null) {
        if ('ApprovalRequired' in payload) {
          const approvalReq = payload.ApprovalRequired;
          setMessages(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'agent',
              content: `Approval required for tool: ${approvalReq.tool_name}`,
              pendingApproval: approvalReq
            }
          ]);
        }
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [setMessages]);

  const handleApproval = async (id: string, approved: boolean, msgId: string) => {
    try {
      await invoke('approve_agent_action', { id, approved });
      setMessages(prev => prev.map(msg => {
        if (msg.id === msgId) {
          return { ...msg, content: msg.content + (approved ? '\n**(Approved)**' : '\n**(Denied)**'), pendingApproval: undefined };
        }
        return msg;
      }));
    } catch (e) {
      console.error("Failed to submit approval", e);
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    try {
      await invoke('clear_thread', { vaultPath, threadId: `agent_${activeAgentChatId}` });
    } catch (e) {
      console.error("Failed to clear chat thread", e);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      await invoke('append_message_to_thread', { vaultPath, threadId: `agent_${activeAgentChatId}`, message: userMessage });
    } catch (e) {
      console.error("Failed to save user message", e);
    }

    try {
      const selectedAgent = agents.find(a => a.id === activeAgentChatId) || {
        id: "coordinator",
        name: "Coordinator",
        system_prompt: "You are the Glade Coordinator Agent. You help users manage their personal knowledge base. Use the provided active file context to answer questions accurately. Do not make up information.",
        model_class: "fast"
      };

      const response = await invoke<string>('invoke_agent', {
        agent: selectedAgent,
        messages: [...messages, userMessage],
        context: activeFileContent ? `Active File Context: ${activeFileContent.path}\n\n${activeFileContent.content}` : '',
        vaultPath
      });

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: response,
      };

      setMessages(prev => [...prev, agentMessage]);
      
      try {
        await invoke('append_message_to_thread', { vaultPath, threadId: `agent_${activeAgentChatId}`, message: agentMessage });
      } catch (e) {
        console.error("Failed to save agent message", e);
      }
      
      window.dispatchEvent(new Event('vault-files-changed'));
    } catch (error) {
      console.error('Agent error:', error);
      
      let friendlyMessage = "An unexpected error occurred while communicating with the AI Agent.";
      let errorCode = "UNKNOWN_ERROR";
      const errorStr = String(error);
      
      if (errorStr.includes("Gemini API Key not set")) {
        friendlyMessage = "Could not connect to the AI Agent. Please check that your Gemini API key is configured correctly in Settings.";
        errorCode = "MISSING_API_KEY";
      } else if (errorStr.includes("401 Unauthorized")) {
        friendlyMessage = "Your API key is invalid or unauthorized. Please check your Gemini API key in Settings.";
        errorCode = "UNAUTHORIZED";
      } else if (errorStr.includes("503") || errorStr.includes("Service overloaded")) {
        friendlyMessage = "The AI service is currently overloaded or unavailable. Please try again later.";
        errorCode = "SERVICE_UNAVAILABLE";
      }

      showError({
        title: "Agent Error",
        friendlyMessage,
        details: errorStr,
        errorCode
      });
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="agent-sidebar">
      <div className="agent-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Bot size={18} style={{ marginRight: '8px' }} />
          <span className="sidebar-title">Glade Agent</span>
        </div>
        <select 
          value={activeAgentChatId} 
          onChange={(e) => setActiveAgentChatId(e.target.value)}
          style={{
            background: 'var(--background-primary)',
            border: '1px solid var(--background-modifier-border)',
            color: 'var(--text-primary)',
            borderRadius: '4px',
            padding: '2px 4px',
            fontSize: '11px',
            maxWidth: '120px'
          }}
        >
          {agents.length === 0 ? (
            <option value="coordinator">Coordinator</option>
          ) : (
            agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))
          )}
        </select>
        <button 
          onClick={handleClearChat}
          title="Clear Chat History"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            marginLeft: 'auto'
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="agent-messages">
        {messages.length === 0 && (
          <div className="agent-empty-state">
            <p>How can I help you today?</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`agent-message ${msg.role}`}>
            <div className="agent-message-avatar">
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="agent-message-content">
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              )}
              {msg.pendingApproval && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button 
                    onClick={() => handleApproval(msg.pendingApproval!.id, true, msg.id)}
                    style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleApproval(msg.pendingApproval!.id, false, msg.id)}
                    style={{ background: 'var(--background-modifier-hover)', color: 'var(--text-primary)', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="agent-message agent">
            <div className="agent-message-avatar"><Bot size={16} /></div>
            <div className="agent-message-content loading-indicator">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="agent-input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask the agent..."
          className="agent-input"
          rows={1}
        />
        <button 
          onClick={handleSend} 
          disabled={isLoading || !input.trim()}
          className="agent-send-btn"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
