import React, { useEffect, useRef, useState } from 'react';
import { usePluginViewContext } from '@prosemirror-adapter/react';
import { TooltipProvider } from '@milkdown/plugin-tooltip';
import { useInstance } from '@milkdown/react';
import { commandsCtx, editorViewCtx } from '@milkdown/core';
import { toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, toggleLinkCommand, wrapInHeadingCommand } from '@milkdown/preset-commonmark';

export const Tooltip = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { view, prevState } = usePluginViewContext();
    const tooltipProvider = useRef<TooltipProvider | null>(null);
    const [loading, getEditor] = useInstance();
    const [isEditingLink, setIsEditingLink] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

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
            ) : (
                <>
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
