import { useEffect, useRef, useState, useMemo } from 'react';
import { usePluginViewContext } from '@prosemirror-adapter/react';
import { SlashProvider } from '@milkdown/plugin-slash';
import { useInstance } from '@milkdown/react';
import { commandsCtx, editorViewCtx } from '@milkdown/core';
import { createCodeBlockCommand, turnIntoTextCommand, wrapInHeadingCommand, wrapInBlockquoteCommand, wrapInBulletListCommand, wrapInOrderedListCommand, insertHrCommand } from '@milkdown/preset-commonmark';

const ALL_ITEMS = [
    { label: 'Text', command: turnIntoTextCommand },
    { label: 'Heading 1', command: wrapInHeadingCommand, payload: 1 },
    { label: 'Heading 2', command: wrapInHeadingCommand, payload: 2 },
    { label: 'Heading 3', command: wrapInHeadingCommand, payload: 3 },
    { label: 'Heading 4', command: wrapInHeadingCommand, payload: 4 },
    { label: 'Heading 5', command: wrapInHeadingCommand, payload: 5 },
    { label: 'Heading 6', command: wrapInHeadingCommand, payload: 6 },
    { label: 'Bullet List', command: wrapInBulletListCommand },
    { label: 'Ordered List', command: wrapInOrderedListCommand },
    { label: 'Quote', command: wrapInBlockquoteCommand },
    { label: 'Code Block', command: createCodeBlockCommand },
    { label: 'Divider', command: insertHrCommand },
];

export const Slash = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { view, prevState } = usePluginViewContext();
    const slashProvider = useRef<SlashProvider | null>(null);
    const [loading, getEditor] = useInstance();
    const [filter, setFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const items = useMemo(() => {
        if (!filter) return ALL_ITEMS;
        const f = filter.toLowerCase();
        return ALL_ITEMS.filter(item => {
            const label = item.label.toLowerCase();
            let fIdx = 0;
            for (let i = 0; i < label.length && fIdx < f.length; i++) {
                if (label[i] === f[fIdx]) fIdx++;
            }
            return fIdx === f.length;
        });
    }, [filter]);

    useEffect(() => {
        if (!ref.current) return;
        const provider = new SlashProvider({
            content: ref.current,
            trigger: '/',
            shouldShow: (view) => {
                const { selection } = view.state;
                if (!selection.empty) return false;
                const $from = selection.$from;
                const node = $from.node($from.depth);
                if (!node || node.type.name !== 'paragraph') return false;
                const content = node.textBetween(0, $from.parentOffset);
                return !!content.match(/(?:^|\s)\/([^\s]*)$/);
            }
        });
        slashProvider.current = provider;

        return () => {
            provider.destroy();
            slashProvider.current = null;
        };
    }, []);

    useEffect(() => {
        if (slashProvider.current && view) {
            slashProvider.current.update(view, prevState);
            
            // Extract typed content manually since update is debounced
            const { selection } = view.state;
            if (selection.empty) {
                const $from = selection.$from;
                const node = $from.node($from.depth);
                if (node && node.type.name === 'paragraph') {
                    const content = node.textBetween(0, $from.parentOffset);
                    const match = content.match(/(?:^|\s)\/([^\s]*)$/);
                    if (match) {
                        setFilter(match[1]);
                        return;
                    }
                }
            }
            
            setFilter('');
            setSelectedIndex(0);
        }
    }, [view, prevState]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [items]);

    const handleCommand = (item: typeof ALL_ITEMS[0]) => {
        if (loading) return;
        getEditor().action((ctx) => {
            const v = ctx.get(editorViewCtx);
            const { dispatch, state } = v;
            
            const len = filter.length + 1; 
            const tr = state.tr.delete(state.selection.from - len, state.selection.from);
            dispatch(tr);

            const commands = ctx.get(commandsCtx);
            commands.call(item.command.key, item.payload);
            
            v.focus();
        });
        if (slashProvider.current) {
            slashProvider.current.hide();
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (slashProvider.current?.element.dataset.show !== 'true') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex((s) => (s + 1) % items.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex((s) => (s - 1 + items.length) % items.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (items[selectedIndex]) {
                    handleCommand(items[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                slashProvider.current.hide();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [items, selectedIndex, filter]);

    return (
        <div ref={ref} className="glade-slash-menu" data-show="false">
            {items.length === 0 ? (
                <div style={{ padding: '4px 8px', color: '#888' }}>No results</div>
            ) : (
                items.map((item, index) => (
                    <button 
                        key={item.label}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            handleCommand(item);
                        }}
                        className={index === selectedIndex ? 'selected' : ''}
                        style={index === selectedIndex ? { backgroundColor: 'var(--hover-background, #2a2d2e)', color: 'var(--hover-text, #ffffff)' } : {}}
                    >
                        {item.label}
                    </button>
                ))
            )}
        </div>
    );
};
