import { useEffect, useState, useRef } from 'react';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';
import { SearchQuery, setSearchState, findNext, findPrev, replaceNext, replaceAll, getSearchState } from 'prosemirror-search';

export const FindReplace = () => {
    const [loading, getEditor] = useInstance();
    const [visible, setVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');
    const [position, setPosition] = useState({ top: 20, left: -1 }); // left -1 means use default right: 20
    const inputRef = useRef<HTMLInputElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const widgetRef = useRef<HTMLDivElement>(null);
    const [matchCount, setMatchCount] = useState({ active: 0, total: 0 });

    useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => {
            const editor = getEditor();
            if (editor) {
                editor.action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    const state = getSearchState(view.state);
                    if (state && (state as any).deco) {
                        const decos = (state as any).deco.find();
                        const total = decos.length;
                        const active = decos.findIndex((d: any) => d.spec.class === 'ProseMirror-active-search-match') + 1;
                        setMatchCount({ active, total });
                    } else {
                        setMatchCount({ active: 0, total: 0 });
                    }
                });
            }
        }, 200);
        return () => clearInterval(interval);
    }, [visible, getEditor]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                e.stopPropagation();
                
                let selectedText = '';
                let newPos = { top: 20, left: -1 };

                const editor = getEditor();
                if (editor) {
                    editor.action((ctx) => {
                        const view = ctx.get(editorViewCtx);
                        const { state } = view;
                        const { selection } = state;
                        
                        if (!selection.empty) {
                            selectedText = state.doc.textBetween(selection.from, selection.to, ' ');
                        }

                        try {
                            const coords = view.coordsAtPos(selection.from);
                            let top = coords.bottom + 10;
                            let left = coords.left;
                            
                            if (left + 320 > window.innerWidth) {
                                left = window.innerWidth - 340;
                            }
                            if (top + 120 > window.innerHeight) {
                                top = coords.top - 120;
                            }
                            
                            newPos = { top, left };
                        } catch (err) {
                            // fallback
                        }
                    });
                }

                setPosition(newPos);
                setVisible(true);

                if (selectedText) {
                    setSearchQuery(selectedText);
                    if (editor) {
                        editor.action((ctx) => {
                            const view = ctx.get(editorViewCtx);
                            const q = new SearchQuery({ search: selectedText, replace: '' });
                            view.dispatch(setSearchState(view.state.tr, q));
                        });
                    }
                    setTimeout(() => replaceInputRef.current?.focus(), 50);
                    scrollActiveMatchIntoView();
                } else {
                    setTimeout(() => inputRef.current?.focus(), 50);
                }
            }
            if (e.key === 'Escape' && visible) {
                setVisible(false);
                const editor = getEditor();
                if (editor) {
                    editor.action((ctx) => {
                        const view = ctx.get(editorViewCtx);
                        view.focus();
                        view.dispatch(setSearchState(view.state.tr, new SearchQuery({ search: '' })));
                    });
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [visible, getEditor]);

    const updateSearch = (query: string) => {
        setSearchQuery(query);
        if (loading) return;
        const editor = getEditor();
        if (editor) {
            editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                const q = new SearchQuery({ search: query, replace: replaceQuery });
                view.dispatch(setSearchState(view.state.tr, q));
            });
        }
    };

    const updateReplace = (query: string) => {
        setReplaceQuery(query);
        if (loading) return;
        const editor = getEditor();
        if (editor) {
            editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                const q = new SearchQuery({ search: searchQuery, replace: query });
                view.dispatch(setSearchState(view.state.tr, q));
            });
        }
    };

    const scrollActiveMatchIntoView = () => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                const activeMatch = document.querySelector('.ProseMirror-active-search-match');
                if (activeMatch) {
                    activeMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Check for overlap after smooth scroll completes
                    setTimeout(() => {
                        const widget = widgetRef.current;
                        if (!widget) return;
                        
                        // Re-query the match in case it changed
                        const currentMatch = document.querySelector('.ProseMirror-active-search-match');
                        if (!currentMatch) return;

                        const wRect = widget.getBoundingClientRect();
                        const mRect = currentMatch.getBoundingClientRect();
                        
                        const overlap = !(
                            mRect.right < wRect.left - 20 ||
                            mRect.left > wRect.right + 20 ||
                            mRect.bottom < wRect.top - 20 ||
                            mRect.top > wRect.bottom + 20
                        );

                        if (overlap) {
                            let newTop = mRect.top > window.innerHeight / 2 ? 20 : window.innerHeight - wRect.height - 20;
                            let newLeft = window.innerWidth - wRect.width - 20;
                            setPosition({ top: newTop, left: newLeft });
                        }
                    }, 400);
                }
            }, 10);
        });
    };

    const handleNext = () => {
        if (loading) return;
        const editor = getEditor();
        if (editor) {
            editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                findNext(view.state, view.dispatch);
                scrollActiveMatchIntoView();
            });
        }
    };

    const handlePrev = () => {
        if (loading) return;
        const editor = getEditor();
        if (editor) {
            editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                findPrev(view.state, view.dispatch);
                scrollActiveMatchIntoView();
            });
        }
    };

    const handleReplace = () => {
        if (loading) return;
        const editor = getEditor();
        if (editor) {
            editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                replaceNext(view.state, view.dispatch);
                scrollActiveMatchIntoView();
            });
        }
    };

    const handleReplaceAll = () => {
        if (loading) return;
        const editor = getEditor();
        if (editor) {
            editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                replaceAll(view.state, view.dispatch);
            });
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;
        setIsDragging(true);
        if (widgetRef.current) {
            const rect = widgetRef.current.getBoundingClientRect();
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
            e.stopPropagation();
            target.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            let left = e.clientX - dragOffset.x;
            let top = e.clientY - dragOffset.y;
            const w = widgetRef.current?.offsetWidth || 300;
            const h = widgetRef.current?.offsetHeight || 100;
            left = Math.max(0, Math.min(window.innerWidth - w, left));
            top = Math.max(0, Math.min(window.innerHeight - h, top));
            setPosition({ top, left });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    if (!visible) return null;

    return (
        <div 
            ref={widgetRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
            position: 'fixed',
            top: `${position.top}px`,
            ...(position.left === -1 ? { right: '20px' } : { left: `${position.left}px` }),
            background: 'var(--tooltip-background, rgba(30, 30, 30, 0.8))',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--tooltip-border, rgba(255,255,255,0.1))',
            padding: '12px',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            cursor: isDragging ? 'grabbing' : 'grab'
        }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                    ref={inputRef}
                    type="text" 
                    placeholder="Find..." 
                    value={searchQuery}
                    onChange={(e) => updateSearch(e.target.value)}
                    style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        outline: 'none',
                        width: '150px'
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
                />
                {searchQuery && (
                    <span style={{ color: '#888', fontSize: '12px', minWidth: '35px', textAlign: 'center' }}>
                        {matchCount.total > 0 ? `${matchCount.active} of ${matchCount.total}` : '0 of 0'}
                    </span>
                )}
                <button onClick={handlePrev} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>↑</button>
                <button onClick={handleNext} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>↓</button>
                <button onClick={() => setVisible(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', marginLeft: 'auto' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                    ref={replaceInputRef}
                    type="text" 
                    placeholder="Replace..." 
                    value={replaceQuery}
                    onChange={(e) => updateReplace(e.target.value)}
                    style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        outline: 'none',
                        width: '150px'
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleReplace(); }}
                />
                <button onClick={handleReplace} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Replace</button>
                <button onClick={handleReplaceAll} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>All</button>
            </div>
        </div>
    );
};
