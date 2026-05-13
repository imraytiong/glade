import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Send, Bot, User } from 'lucide-react';
import { useError } from '../../contexts/ErrorContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './AgentSidebar.css';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
}

import { readTextFile } from '@tauri-apps/plugin-fs';
import { Agent } from '../../types/agent';

interface AgentSidebarProps {
  activeFileContent: { path: string, content: string } | null;
  vaultPath: string | null;
}

export default function AgentSidebar({ activeFileContent, vaultPath }: AgentSidebarProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('coordinator');
  const [messages, setMessages] = useState<Message[]>([]);
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
        const content = await readTextFile(`${vaultPath}/.glade/agents.json`);
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAgents(parsed);
          // If the previously selected agent doesn't exist anymore, reset it
          if (!parsed.find((a: Agent) => a.id === selectedAgentId)) {
            setSelectedAgentId(parsed[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load agents in sidebar", err);
      }
    };
    loadAgents();
  }, [vaultPath]);

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
      const selectedAgent = agents.find(a => a.id === selectedAgentId) || {
        id: "coordinator",
        name: "Coordinator",
        system_prompt: "You are the Glade Coordinator Agent. You help users manage their personal knowledge base. Use the provided active file context to answer questions accurately. Do not make up information.",
        model_class: "fast"
      };

      const response = await invoke<string>('invoke_agent', {
        agent: selectedAgent,
        query: userMessage.content,
        context: activeFileContent ? `Active File Context: ${activeFileContent.path}\n\n${activeFileContent.content}` : ''
      });

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: response,
      };

      setMessages(prev => [...prev, agentMessage]);
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
          value={selectedAgentId} 
          onChange={(e) => setSelectedAgentId(e.target.value)}
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
