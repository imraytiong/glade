import { useEffect, useRef, useState, useMemo } from 'react';
import { usePluginViewContext } from '@prosemirror-adapter/react';
import { SlashProvider } from '@milkdown/plugin-slash';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { globalIndexer } from '../utils/indexer';
import { fetch } from '@tauri-apps/plugin-http';

export const WikiLink = ({ workspaceRoot }: { workspaceRoot: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { view, prevState } = usePluginViewContext();
    const slashProvider = useRef<SlashProvider | null>(null);
    const [loading, getEditor] = useInstance();
    const [filter, setFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mdFiles, setMdFiles] = useState<string[]>([]);
    const [resolvedTitle, setResolvedTitle] = useState<string | null>(null);

    useEffect(() => {
        const updateFiles = () => {
            const files = globalIndexer.getFiles()
                .filter(f => !f.isDirectory && f.name.endsWith('.md'))
                .map(f => {
                    if (workspaceRoot && f.path.startsWith(workspaceRoot)) {
                        return f.path.slice(workspaceRoot.length).replace(/^\//, '');
                    }
                    return f.name; // fallback
                });
            setMdFiles(files);
        };
        
        updateFiles();
        return globalIndexer.subscribe(updateFiles);
    }, [workspaceRoot]);

    const items = useMemo(() => {
        let result: string[] = [];
        if (!filter) {
            result = mdFiles.slice(0, 10);
        } else {
            const f = filter.toLowerCase();
            result = mdFiles.filter(item => item.toLowerCase().includes(f)).slice(0, 10);
        }

        if (filter.startsWith('http://') || filter.startsWith('https://')) {
            // Remove exact duplicates if any
            result = result.filter(r => r !== filter);
            result.unshift(filter);
        }

        return result;
    }, [filter, mdFiles]);

    useEffect(() => {
        if (!filter) {
            setResolvedTitle(null);
            return;
        }

        const isHttp = filter.startsWith('http://') || filter.startsWith('https://');
        if (!isHttp) {
            setResolvedTitle(null);
            return;
        }

        let isCancelled = false;
        
        const fetchTitle = async () => {
            try {
                const response = await fetch(filter, { method: 'GET' });
                if (response.ok && !isCancelled) {
                    const text = await response.text();
                    const match = text.match(/<title[^>]*>([^<]+)<\/title>/i);
                    if (match && match[1]) {
                        // Decode HTML entities if needed (simple replacements for common ones)
                        const title = match[1].trim()
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'");
                        setResolvedTitle(title);
                    }
                }
            } catch (err) {
                // Silently fail if we can't fetch (e.g. invalid URL, network error)
            }
        };

        const timer = setTimeout(fetchTitle, 500); // 500ms debounce
        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [filter]);

    useEffect(() => {
        if (!ref.current) return;
        const provider = new SlashProvider({
            content: ref.current,
            trigger: '[',
            shouldShow: (view) => {
                const { selection } = view.state;
                if (!selection.empty) return false;
                const $from = selection.$from;
                const node = $from.node($from.depth);
                if (!node || node.type.name !== 'paragraph') return false;
                const content = node.textBetween(0, $from.parentOffset);
                return !!content.match(/(?:^|\s)\[\[([^\]]*)$/);
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
            
            // Extract typed content
            const { selection } = view.state;
            if (selection.empty) {
                const $from = selection.$from;
                const node = $from.node($from.depth);
                if (node && node.type.name === 'paragraph') {
                    const content = node.textBetween(0, $from.parentOffset);
                    const match = content.match(/(?:^|\s)\[\[([^\]]*)$/);
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

    const handleSelect = (item: string) => {
        if (loading) return;
        getEditor().action((ctx) => {
            const v = ctx.get(editorViewCtx);
            const { dispatch, state } = v;
            
            const len = filter.length + 2; // +2 for '[['
            
            // Delete the typed [[...
            let tr = state.tr.delete(state.selection.from - len, state.selection.from);
            
            // Extract filename without extension for the label
            const isHttp = item.startsWith('http://') || item.startsWith('https://');
            const filename = isHttp ? (resolvedTitle || item) : (item.split('/').pop()?.replace(/\.md$/, '') || item);
            
            // Insert the text and add the link mark
            const markType = state.schema.marks.link;
            if (markType) {
                const linkMark = markType.create({ href: item, title: filename });
                const insertPos = tr.selection.from;
                tr = tr.insertText(filename, insertPos);
                tr = tr.addMark(insertPos, insertPos + filename.length, linkMark);
                
                // Add a trailing space to exit the link
                tr = tr.insertText(' ', insertPos + filename.length);
                tr = tr.removeStoredMark(markType);
            } else {
                tr = tr.insertText(`[${filename}](${item}) `, tr.selection.from);
            }
            
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
            } else if (e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                // If it's an HTTP link and we have a resolved title, tab can autocomplete the title into the editor?
                // Wait, if it's Tab, usually it just completes the filter.
                // But let's just make it do handleSelect for now if we don't have a distinct completion behavior.
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
    }, [items, selectedIndex, filter, resolvedTitle]);

    return (
        <div ref={ref} className="glade-slash-menu" data-show="false">
            {items.length === 0 ? (
                <div style={{ padding: '4px 8px', color: '#888' }}>No results</div>
            ) : (
                items.map((item, index) => (
                    <button 
                        key={item}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelect(item);
                        }}
                        className={index === selectedIndex ? 'selected' : ''}
                        style={index === selectedIndex ? { backgroundColor: 'var(--hover-background, #2a2d2e)', color: 'var(--hover-text, #ffffff)' } : {}}
                    >
                        {item.startsWith('http') 
                            ? `Insert Link: ${resolvedTitle ? `${resolvedTitle} (${item})` : item}` 
                            : item}
                    </button>
                ))
            )}
        </div>
    );
};
