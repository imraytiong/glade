import { useEffect, useRef, useState } from 'react';
import { usePluginViewContext } from '@prosemirror-adapter/react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { replaceRange } from '@milkdown/utils';
import { invoke } from '@tauri-apps/api/core';
import { Bot, Loader2 } from 'lucide-react';
import { useError } from '../contexts/ErrorContext';

import { Agent } from '../types/agent';

export const AgentPrompt = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { view } = usePluginViewContext();
    const [loading, getEditor] = useInstance();
    const [prompt, setPrompt] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('refactor');
    
    // Manage visibility and position ourselves
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [targetSelection, setTargetSelection] = useState<{from: number, to: number} | null>(null);

    useEffect(() => {
        const handleOpenPrompt = (e: any) => {
            if (!view) return;
            const selection = e.detail || { from: view.state.selection.from, to: view.state.selection.to };
            setTargetSelection(selection);
            
            // Calculate position
            try {
                const coords = view.coordsAtPos(selection.from);
                setPosition({
                    top: coords.bottom + 10,
                    left: coords.left
                });
            } catch (err) {
                console.warn("Failed to get coords", err);
            }
            
            setIsOpen(true);
            setPrompt('');
        };
        
        window.addEventListener('open-agent-prompt', handleOpenPrompt);
        return () => window.removeEventListener('open-agent-prompt', handleOpenPrompt);
    }, [view]);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isOpen && ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    useEffect(() => {
        const loadAgents = async () => {
            const vaultPath = localStorage.getItem('glade_vault_path');
            if (!vaultPath) return;
            try {
                const agentsData = await invoke<Agent[]>('get_agents', { vaultPath });
                if (Array.isArray(agentsData) && agentsData.length > 0) {
                    setAgents(agentsData);
                    if (!agentsData.find((a: Agent) => a.id === selectedAgentId)) {
                        const refactorAgent = agentsData.find((a: Agent) => a.id === 'refactor');
                        setSelectedAgentId(refactorAgent ? 'refactor' : agentsData[0].id);
                    }
                }
            } catch (err) {
                console.warn("Failed to load agents in inline prompt", err);
            }
        };
        loadAgents();
    }, [isOpen]);

    const { showError } = useError();

    const executePrompt = async () => {
        if (loading || !prompt.trim() || !view) return;
        if (!targetSelection) return;

        setIsThinking(true);
        try {
            const selectedAgent = agents.find(a => a.id === selectedAgentId) || {
                id: "refactor",
                name: "Refactor",
                system_prompt: "You are an expert editor. You rewrite the user's provided text according to their prompt. Return ONLY the rewritten valid Markdown. Do not include introductory or conversational text like 'Here is the rewritten text:'.",
                model_class: "fast"
            };

            // Call the agent
            const response = await invoke<string>('invoke_agent', {
                agent: selectedAgent,
                messages: [{ role: 'user', content: prompt.trim() }],
                context: '',
                vaultPath: localStorage.getItem('glade_vault_path')
            });

            const editor = getEditor();
            if (editor) {
                editor.action((ctx) => {
                    replaceRange(response, targetSelection)(ctx);
                    const v = ctx.get(editorViewCtx);
                    v.focus();
                });
            }
            window.dispatchEvent(new Event('vault-files-changed'));
        } catch (err) {
            console.error("Agent error:", err);
            
            let friendlyMessage = "An unexpected error occurred while generating text.";
            let errorCode = "UNKNOWN_ERROR";
            const errorStr = String(err);
            
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
                title: "Generation Error",
                friendlyMessage,
                details: errorStr,
                errorCode
            });
        } finally {
            setIsThinking(false);
            setIsOpen(false);
            setPrompt('');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                const editor = getEditor();
                if (editor) {
                    editor.action((ctx) => ctx.get(editorViewCtx).focus());
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div 
            ref={ref} 
            className="agent-prompt-menu" 
            style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                background: 'var(--background-secondary)',
                border: '1px solid var(--interactive-accent)',
                borderRadius: '8px',
                padding: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                width: '300px',
                zIndex: 100
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--interactive-accent)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
                    <Bot size={14} />
                    Glade AI
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
                        <option value="refactor">Refactor</option>
                    ) : (
                        agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))
                    )}
                </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    autoFocus
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            executePrompt();
                        }
                    }}
                    placeholder="Ask AI to generate text..."
                    disabled={isThinking}
                    style={{
                        flex: 1,
                        background: 'var(--background-primary)',
                        border: '1px solid var(--divider-color)',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        color: 'var(--text-normal)',
                        outline: 'none',
                        fontSize: '14px'
                    }}
                />
                {isThinking && (
                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--interactive-accent)' }}>
                        <Loader2 size={16} className="spin" />
                    </div>
                )}
            </div>
        </div>
    );
};
