import { useRef, useEffect, useState } from 'react';
import { usePluginViewContext } from '@prosemirror-adapter/react';
import { TooltipProvider } from '@milkdown/plugin-tooltip';
import { useInstance } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/core';

/**
 * Helper function to get the range of a mark at a given position.
 * @param {$pos} $pos - The resolved position in the editor state.
 * @param {any} type - The mark type to look for.
 * @returns {object | null} An object containing `from`, `to` (absolute positions) and the `mark` itself, or null if no mark is found.
 */
function getMarkRange($pos: any, type: any) {
    if (!$pos || !type) return null;

    let start = $pos.parent.childAfter($pos.parentOffset);
    if (!start.node) {
        // If cursor is exactly at the end of the mark, childAfter might be null or have no mark.
        // Check childBefore
        start = $pos.parent.childBefore($pos.parentOffset);
        if (!start.node) return null;
    }

    const mark = start.node.marks.find((m: any) => m.type === type);
    if (!mark) {
        // Check childBefore just in case
        const before = $pos.parent.childBefore($pos.parentOffset);
        if (before.node) {
            const markBefore = before.node.marks.find((m: any) => m.type === type);
            if (markBefore) {
                start = before;
                return expandMarkRange($pos, markBefore, start.offset);
            }
        }
        return null;
    }

    return expandMarkRange($pos, mark, start.offset);
}

/**
 * Helper function to expand the range of a given mark.
 * This ensures the entire mark is covered, even if the initial $pos is only within a part of it.
 * @param {$pos} $pos - The resolved position in the editor state.
 * @param {any} mark - The mark instance to expand around.
 * @param {number} startOffset - The starting offset of the node containing the mark within its parent.
 * @returns {object | null} An object containing `from`, `to` (absolute positions) and the `mark` itself, or null if the position is not within the mark.
 */
function expandMarkRange($pos: any, mark: any, startOffset: number) {
    let startIndex = $pos.index();
    let startPos = $pos.start() + startOffset;
    
    // adjust startIndex if we used childBefore
    if (startPos >= $pos.pos) {
        startIndex = $pos.index() - 1;
        if (startIndex < 0) startIndex = 0;
        startPos = $pos.start() + $pos.parent.child(startIndex).offset || 0; // Wait, offset is not simple.
    }

    // Let's just iterate through parent's children to compute absolute positions safely
    let markStart = -1;
    let markEnd = -1;
    
    $pos.parent.forEach((child: any, offset: number) => {
        if (mark.isInSet(child.marks)) {
            if (markStart === -1) {
                markStart = $pos.start() + offset;
            }
            markEnd = $pos.start() + offset + child.nodeSize;
        } else {
            if (markStart !== -1 && offset + $pos.start() >= $pos.pos) {
                // we passed our pos, so we found the chunk
            } else if (offset + $pos.start() < $pos.pos) {
                // reset if we haven't reached pos
                markStart = -1;
            }
        }
    });

    if (markStart === -1 || $pos.pos < markStart || $pos.pos > markEnd) return null;

    return { from: markStart, to: markEnd, mark };
}

/**
 * LinkTooltip component for Milkdown editor.
 * This component provides an inline tooltip that appears when the user's cursor is within a link.
 * It allows users to view, edit, or remove the link's text and URL.
 *
 * @component
 * @returns {JSX.Element} The LinkTooltip component, rendering an editable tooltip for links.
 */
export const LinkTooltip = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { view, prevState } = usePluginViewContext();
    const tooltipProvider = useRef<TooltipProvider | null>(null);
    const [loading, getEditor] = useInstance();
    
    const [linkData, setLinkData] = useState<{href: string, title: string, text: string, from: number, to: number} | null>(null);

    const [editHref, setEditHref] = useState('');
    const [editText, setEditText] = useState('');

    useEffect(() => {
        if (!ref.current || !view) return;
        
        const provider = new TooltipProvider({
            content: ref.current,
            shouldShow: (view) => {
                const { state } = view;
                const { selection } = state;
                const $pos = selection.$from;
                const linkType = state.schema.marks.link;
                if (!linkType) return false;
                
                // If user is actively highlighting text and it includes multiple things, standard tooltip shows.
                // We only show Link Editor if cursor is inside a link or whole link is selected.
                const range = getMarkRange($pos, linkType);
                return !!range;
            }
        });
        tooltipProvider.current = provider;

        return () => {
            provider.destroy();
            tooltipProvider.current = null;
        };
    }, [view]);

    useEffect(() => {
        if (tooltipProvider.current && view) {
            tooltipProvider.current.update(view, prevState);
            
            const { state } = view;
            const $pos = state.selection.$from;
            const linkType = state.schema.marks.link;
            if (linkType) {
                const range = getMarkRange($pos, linkType);
                if (range) {
                    const text = state.doc.textBetween(range.from, range.to);
                    if (!linkData || linkData.from !== range.from || linkData.to !== range.to || linkData.text !== text) {
                        const newLinkData = {
                            href: range.mark.attrs.href,
                            title: range.mark.attrs.title || '',
                            text: text,
                            from: range.from,
                            to: range.to
                        };
                        setLinkData(newLinkData);
                        setEditHref(newLinkData.href);
                        setEditText(newLinkData.text);
                    }
                    return;
                }
            }
            setLinkData(null);
        }
    }, [view, prevState]);

    const handleSave = () => {
        if (loading || !linkData || !view) return;
        getEditor().action((ctx) => {
            const v = ctx.get(editorViewCtx);
            const { state, dispatch } = v;
            let tr = state.tr;
            
            const linkType = state.schema.marks.link;
            
            // Delete old link
            tr = tr.delete(linkData.from, linkData.to);
            
            // Insert new text with new mark
            const newMark = linkType.create({ href: editHref, title: linkData.title });
            tr = tr.insertText(editText, linkData.from);
            tr = tr.addMark(linkData.from, linkData.from + editText.length, newMark);
            
            dispatch(tr);
            v.focus();
        });
        tooltipProvider.current?.hide();
    };

    const handleRemove = () => {
        if (loading || !linkData || !view) return;
        getEditor().action((ctx) => {
            const v = ctx.get(editorViewCtx);
            const { state, dispatch } = v;
            let tr = state.tr;
            
            const linkType = state.schema.marks.link;
            
            // Just remove the mark, keep the text
            tr = tr.removeMark(linkData.from, linkData.to, linkType);
            
            dispatch(tr);
            v.focus();
        });
        tooltipProvider.current?.hide();
    };

    if (!linkData) return (
        <div ref={ref} className="glade-tooltip" data-show="false" style={{ display: 'none' }}></div>
    );

    return (
        <div ref={ref} className="glade-tooltip" data-show="false" style={{ 
            display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px',
            backgroundColor: 'rgba(30,30,30,0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #444',
            borderRadius: '8px',
            width: '280px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase' }}>Text</label>
                <input 
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    style={{ 
                        background: 'rgba(0,0,0,0.3)', border: '1px solid #555', 
                        color: 'white', padding: '6px', borderRadius: '4px',
                        outline: 'none', fontFamily: 'inherit'
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                    }}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase' }}>Link</label>
                <input 
                    value={editHref}
                    onChange={e => setEditHref(e.target.value)}
                    style={{ 
                        background: 'rgba(0,0,0,0.3)', border: '1px solid #555', 
                        color: 'white', padding: '6px', borderRadius: '4px',
                        outline: 'none', fontFamily: 'inherit'
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                    }}
                />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button 
                    onClick={handleSave}
                    style={{ 
                        flex: 1, padding: '6px', background: '#3b82f6', color: 'white', 
                        border: 'none', borderRadius: '4px', cursor: 'pointer' 
                    }}
                >
                    Save
                </button>
                <button 
                    onClick={handleRemove}
                    style={{ 
                        flex: 1, padding: '6px', background: 'transparent', color: '#ef4444', 
                        border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer' 
                    }}
                >
                    Remove
                </button>
            </div>
        </div>
    );
};
