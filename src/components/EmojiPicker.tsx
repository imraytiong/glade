import { useEffect, useRef, useState, useMemo } from 'react';
import { usePluginViewContext } from '@prosemirror-adapter/react';
import { SlashProvider } from '@milkdown/plugin-slash';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { gemoji } from 'gemoji';

export const EmojiPicker = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { view, prevState } = usePluginViewContext();
    const slashProvider = useRef<SlashProvider | null>(null);
    const [loading, getEditor] = useInstance();
    const [filter, setFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const items = useMemo(() => {
        if (!filter) return gemoji.slice(0, 10);
        const f = filter.toLowerCase();
        return gemoji.filter(item => {
            return item.names.some(name => name.includes(f)) || item.tags.some(tag => tag.includes(f));
        }).slice(0, 10);
    }, [filter]);

    useEffect(() => {
        if (!ref.current) return;
        const provider = new SlashProvider({
            content: ref.current,
            trigger: ':',
            shouldShow: (view) => {
                const { selection } = view.state;
                if (!selection.empty) return false;
                const $from = selection.$from;
                const node = $from.node($from.depth);
                if (!node || node.type.name !== 'paragraph') return false;
                const content = node.textBetween(0, $from.parentOffset);
                return !!content.match(/(?:^|\s):([a-zA-Z0-9_+-]*)$/);
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
            
            // Extract typed content manually
            const { selection } = view.state;
            if (selection.empty) {
                const $from = selection.$from;
                const node = $from.node($from.depth);
                if (node && node.type.name === 'paragraph') {
                    const content = node.textBetween(0, $from.parentOffset);
                    const match = content.match(/(?:^|\s):([a-zA-Z0-9_+-]*)$/);
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

    const handleSelect = (item: typeof gemoji[0]) => {
        if (loading) return;
        getEditor().action((ctx) => {
            const v = ctx.get(editorViewCtx);
            const { dispatch, state } = v;
            
            const len = filter.length + 1; // +1 for ':'
            
            // Delete the typed :...
            let tr = state.tr.delete(state.selection.from - len, state.selection.from);
            
            // Insert the emoji
            tr = tr.insertText(item.emoji, tr.selection.from);
            dispatch(tr);
            
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
                    handleSelect(items[selectedIndex]);
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
                        key={item.emoji}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelect(item);
                        }}
                        className={index === selectedIndex ? 'selected' : ''}
                        style={index === selectedIndex ? { backgroundColor: 'var(--hover-background, #2a2d2e)', color: 'var(--hover-text, #ffffff)', display: 'flex', gap: '8px', alignItems: 'center' } : { display: 'flex', gap: '8px', alignItems: 'center' }}
                    >
                        <span style={{ fontSize: '1.2em' }}>{item.emoji}</span>
                        <span>:{item.names[0]}:</span>
                    </button>
                ))
            )}
        </div>
    );
};
