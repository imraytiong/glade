import { useEffect, useState, useRef } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export const HoverPreview = ({ workspaceRoot }: { workspaceRoot: string }) => {
    const [previewPath, setPreviewPath] = useState<string | null>(null);
    const [previewContent, setPreviewContent] = useState<string>('');
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const hoverTimeout = useRef<number | null>(null);
    const leaveTimeout = useRef<number | null>(null);

    useEffect(() => {
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest('a');
            
            if (anchor) {
                const href = anchor.getAttribute('href');
                // Ensure it's a valid relative path and not a hashtag or external link
                if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#')) {
                    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
                    leaveTimeout.current = null;
                    
                    if (previewPath !== href) {
                        hoverTimeout.current = window.setTimeout(() => {
                            const rect = anchor.getBoundingClientRect();
                            setPosition({
                                top: rect.bottom + 5,
                                left: rect.left
                            });
                            setPreviewPath(href);
                        }, 400); // 400ms delay to prevent accidental triggers
                    }
                }
            } else {
                // Not over an anchor, start leave timeout if not hovering over the preview itself
                if (!target.closest('.glade-hover-preview')) {
                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                    if (previewPath && !leaveTimeout.current) {
                        leaveTimeout.current = window.setTimeout(() => {
                            setPreviewPath(null);
                            setPreviewContent('');
                        }, 250);
                    }
                }
            }
        };

        document.addEventListener('mouseover', handleMouseOver);
        return () => {
            document.removeEventListener('mouseover', handleMouseOver);
            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
            if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
        };
    }, [previewPath]);

    useEffect(() => {
        if (!previewPath || !workspaceRoot) return;

        const loadPreview = async () => {
            try {
                // Handle paths that might be absolute already or relative
                const fullPath = previewPath.startsWith(workspaceRoot) ? previewPath : await join(workspaceRoot, previewPath);
                const content = await readTextFile(fullPath);
                // Simple truncate to first 400 chars or so
                setPreviewContent(content.slice(0, 400) + (content.length > 400 ? '...' : ''));
            } catch (error) {
                console.error("Failed to read file for preview", error);
                setPreviewContent("Failed to load preview.");
            }
        };
        loadPreview();
    }, [previewPath, workspaceRoot]);

    if (!previewPath) return null;

    return (
        <div 
            className="glade-hover-preview"
            style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                width: '350px',
                maxHeight: '250px',
                overflow: 'hidden',
                backgroundColor: 'rgba(30, 30, 30, 0.85)',
                color: '#e0e0e0',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                zIndex: 1000,
                pointerEvents: 'auto',
                fontSize: '14px',
                lineHeight: '1.5',
                fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
                whiteSpace: 'pre-wrap',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                transition: 'opacity 0.2s ease',
            }}
            onMouseOver={() => {
                if (leaveTimeout.current) {
                    clearTimeout(leaveTimeout.current);
                    leaveTimeout.current = null;
                }
            }}
            onMouseLeave={() => {
                leaveTimeout.current = window.setTimeout(() => {
                    setPreviewPath(null);
                    setPreviewContent('');
                }, 250);
            }}
        >
            <div style={{ fontWeight: 500, marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#888', fontSize: '12px', wordBreak: 'break-all' }}>
                {previewPath}
            </div>
            <div style={{ opacity: 0.9 }}>
                {previewContent || 'Loading...'}
            </div>
        </div>
    );
};
