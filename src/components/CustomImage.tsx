import { useEffect, useState } from 'react';
import { useNodeViewContext } from '@prosemirror-adapter/react';
import { convertFileSrc } from '@tauri-apps/api/core';

export const CustomImage = ({ workspaceRoot, filePath }: { workspaceRoot?: string, filePath?: string }) => {
    const { node } = useNodeViewContext();
    const src = node.attrs.src || '';
    const alt = node.attrs.alt || '';
    const title = node.attrs.title || '';

    const [resolvedSrc, setResolvedSrc] = useState(src);

    useEffect(() => {
        if (!src) return;

        // If it's a web URL or data URI, leave it alone
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
            setResolvedSrc(src);
            return;
        }

        // If it's already a Tauri asset, leave it
        if (src.startsWith('asset://')) {
            setResolvedSrc(src);
            return;
        }

        let absolutePath = src;
        
        // If it's an absolute path on mac/linux/windows (e.g. /Users/... or C:\...)
        const isAbsolute = src.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(src);

        if (!isAbsolute) {
            // It's a relative path, resolve it relative to the current filePath
            if (filePath) {
                const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
                
                // Simple path normalization
                const parts = `${dir}/${src}`.split(/[/\\]/);
                const result: string[] = [];
                for (const part of parts) {
                    if (part === '.' || part === '') continue;
                    if (part === '..') {
                        if (result.length > 0) result.pop();
                    } else {
                        result.push(part);
                    }
                }
                absolutePath = (filePath.startsWith('/') ? '/' : '') + result.join('/');
            } else if (workspaceRoot) {
                absolutePath = `${workspaceRoot}/${src}`;
            }
        }

        try {
            const assetUrl = convertFileSrc(absolutePath);
            setResolvedSrc(assetUrl);
        } catch (e) {
            console.error("Failed to convert image src:", src, e);
            setResolvedSrc(src);
        }
    }, [src, workspaceRoot, filePath]);

    return (
        <span className="glade-image-container">
            <img 
                src={resolvedSrc} 
                alt={alt} 
                title={title} 
                style={{ maxWidth: '100%', display: 'inline-block', borderRadius: '4px' }} 
            />
        </span>
    );
};
