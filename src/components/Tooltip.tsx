import React, { useEffect, useRef, useState } from 'react';
import { usePluginViewContext } from '@prosemirror-adapter/react';
import { TooltipProvider } from '@milkdown/plugin-tooltip';
import { useInstance } from '@milkdown/react';
import { commandsCtx, editorViewCtx } from '@milkdown/core';
import { toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, toggleLinkCommand, wrapInHeadingCommand } from '@milkdown/preset-commonmark';
import { invoke } from '../utils/api';
import { Bot, Loader2 } from 'lucide-react';
import { useError } from '../contexts/ErrorContext';

export const Tooltip = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { view, prevState } = usePluginViewContext();
    const tooltipProvider = useRef<TooltipProvider | null>(null);
    const [loading, getEditor] = useInstance();
    const [isEditingLink, setIsEditingLink] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    
    // AI Refactor State
    const [isRefactoring, setIsRefactoring] = useState(false);
    const [refactorPrompt, setRefactorPrompt] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    
    const { showError } = useError();

    useEffect(() => {
        if (!ref.current) return;
        const provider = new TooltipProvider({
            content: ref.current,
            shouldShow: (v) => {
                const { selection } = v.state;
                return !selection.empty;
            },
        });
        provider.onHide = () => {
            setIsEditingLink(false);
            setLinkUrl('');
            setIsRefactoring(false);
            setRefactorPrompt('');
            setIsThinking(false);
        };
        tooltipProvider.current = provider;

        return () => {
            provider.destroy();
            tooltipProvider.current = null;
        };
    }, []);

    useEffect(() => {
        if (tooltipProvider.current && view) {
            tooltipProvider.current.update(view, prevState);
        }
    }, [view, prevState]);

    const handleFormat = (e: React.MouseEvent, command: any) => {
        e.preventDefault();
        if (loading) return;

        if (command === toggleLinkCommand) {
            setIsEditingLink(true);
            setIsRefactoring(false);
            return;
        }

        getEditor().action((ctx) => {
            const commands = ctx.get(commandsCtx);
            commands.call(command.key);
        });
    };

    const handleHeading = (e: React.MouseEvent, level: number) => {
        e.preventDefault();
        if (loading) return;
        getEditor().action((ctx) => {
            const commands = ctx.get(commandsCtx);
            commands.call(wrapInHeadingCommand.key, level);
        });
    };

    const applyLink = () => {
        if (loading) return;
        getEditor().action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { state } = view;
            const { from, to } = state.selection;
            
            if (from !== to && linkUrl) {
                const commands = ctx.get(commandsCtx);
                commands.call(toggleLinkCommand.key, { href: linkUrl });
            }
            view.focus();
        });
        setIsEditingLink(false);
        setLinkUrl('');
        if (tooltipProvider.current) {
            tooltipProvider.current.hide();
        }
    };

    const applyRefactor = async () => {
        if (loading || !refactorPrompt.trim()) return;
        
        setIsThinking(true);
        let selectedText = '';
        
        getEditor().action((ctx) => {
            const v = ctx.get(editorViewCtx);
            const { state } = v;
            const { from, to } = state.selection;
            selectedText = state.doc.textBetween(from, to, '\n');
        });

        try {
            const fullPrompt = `${refactorPrompt}\n\n[Selected Text to Refactor]\n${selectedText}`;
            
            const response = await invoke<string>('invoke_agent', {
                agentId: 'refactor',
                query: fullPrompt,
                context: ''
            });

            const editor = getEditor();
            if (editor) {
                editor.action((ctx) => {
                    const v = ctx.get(editorViewCtx);
                    const { state, dispatch } = v;
                    const { from, to } = state.selection;
                    
                    // Replace selected text
                    const tr = state.tr.replaceWith(
                        from,
                        to,
                        state.schema.text(response)
                    );
                    dispatch(tr);
                    v.focus();
                });
            }
        } catch (err) {
            console.error('Agent Refactor Error:', err);
            
            let friendlyMessage = "An unexpected error occurred while refactoring text.";
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
                title: "Refactor Error",
                friendlyMessage,
                details: errorStr,
                errorCode
            });
        } finally {
            setIsThinking(false);
            setIsRefactoring(false);
            setRefactorPrompt('');
            if (tooltipProvider.current) {
                tooltipProvider.current.hide();
            }
        }
    };

    return (
        <div ref={ref} className="glade-tooltip" data-show="false">
            {isEditingLink ? (
                <div style={{ display: 'flex', padding: '4px', gap: '4px' }}>
                    <input
                        type="text"
                        placeholder="https://"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                applyLink();
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsEditingLink(false);
                                setLinkUrl('');
                            }
                        }}
                        autoFocus
                        style={{
                            background: 'transparent',
                            border: '1px solid #555',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            outline: 'none'
                        }}
                    />
                    <button onMouseDown={(e) => { e.preventDefault(); applyLink(); }}>Apply</button>
                    <button onMouseDown={(e) => { e.preventDefault(); setIsEditingLink(false); setLinkUrl(''); }}>Cancel</button>
                </div>
            ) : isRefactoring ? (
                <div style={{ display: 'flex', padding: '4px', gap: '4px', alignItems: 'center' }}>
                    <Bot size={14} style={{ color: 'var(--interactive-accent)' }} />
                    <input
                        type="text"
                        placeholder="Rewrite to be more professional..."
                        value={refactorPrompt}
                        onChange={(e) => setRefactorPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                applyRefactor();
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsRefactoring(false);
                                setRefactorPrompt('');
                            }
                        }}
                        autoFocus
                        disabled={isThinking}
                        style={{
                            background: 'transparent',
                            border: '1px solid #555',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            outline: 'none',
                            width: '200px'
                        }}
                    />
                    {isThinking ? (
                        <Loader2 size={14} className="spin" style={{ color: 'var(--interactive-accent)' }} />
                    ) : (
                        <>
                            <button onMouseDown={(e) => { e.preventDefault(); applyRefactor(); }}>Refactor</button>
                            <button onMouseDown={(e) => { e.preventDefault(); setIsRefactoring(false); setRefactorPrompt(''); }}>Cancel</button>
                        </>
                    )}
                </div>
            ) : (
                <>
                    <button 
                        onMouseDown={(e) => { 
                            e.preventDefault(); 
                            setIsRefactoring(true); 
                            setIsEditingLink(false);
                        }}
                        title="Refactor with AI"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--interactive-accent)' }}
                    >
                        <Bot size={14} /> AI
                    </button>
                    <span style={{ borderLeft: '1px solid #555', margin: '0 4px' }} />
                    <button onMouseDown={(e) => handleFormat(e, toggleStrongCommand)}>Bold</button>
                    <button onMouseDown={(e) => handleFormat(e, toggleEmphasisCommand)}>Italic</button>
                    <button onMouseDown={(e) => handleFormat(e, toggleInlineCodeCommand)}>Code</button>
                    <button onMouseDown={(e) => handleFormat(e, toggleLinkCommand)}>Link</button>
                    <span style={{ borderLeft: '1px solid #555', margin: '0 4px' }} />
                    <button onMouseDown={(e) => handleHeading(e, 1)}>H1</button>
                    <button onMouseDown={(e) => handleHeading(e, 2)}>H2</button>
                    <button onMouseDown={(e) => handleHeading(e, 3)}>H3</button>
                    <button onMouseDown={(e) => handleHeading(e, 4)}>H4</button>
                    <button onMouseDown={(e) => handleHeading(e, 5)}>H5</button>
                    <button onMouseDown={(e) => handleHeading(e, 6)}>H6</button>
                </>
            )}
        </div>
    );
};
