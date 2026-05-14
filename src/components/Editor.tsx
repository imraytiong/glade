import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { editorViewCtx } from '@milkdown/core';
import { Milkdown, MilkdownProvider } from '@milkdown/react';
import { ProsemirrorAdapterProvider } from '@prosemirror-adapter/react';
import { FindReplace } from './FindReplace';
import { HoverPreview } from './HoverPreview';
import 'prismjs/themes/prism-tomorrow.css';
import './Editor.css';

import { getCurrentWebview } from '@tauri-apps/api/webview';
import { copyFile, mkdir } from '../utils/fs';
import { basename, dirname } from '@tauri-apps/api/path';

export interface EditorHandle {
  insertLink: (file: { name: string, path: string }) => void;
  scrollToHeader: (hash: string) => void;
}

import { EditorProps, useGladeEditor } from './useGladeEditor';

const MilkdownInner = forwardRef<EditorHandle, EditorProps>((props, ref) => {
  const { get } = useGladeEditor(props);

  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | undefined;
    
    try {
      const webview = getCurrentWebview();
      webview.onDragDropEvent((event) => {
        if (event.payload.type === 'drop') {
          const { paths, position } = event.payload;
          if (paths && paths.length > 0) {
            const editor = get();
            if (!editor) return;

            editor.action(async (ctx) => {
              const view = ctx.get(editorViewCtx);
              const logicalX = position.x / window.devicePixelRatio;
              const logicalY = position.y / window.devicePixelRatio;
              const posAt = view.posAtCoords({ left: logicalX, top: logicalY });
              const pos = posAt ? posAt.pos : view.state.selection.from;
              
              // To avoid inserting multiple texts at the same position, we keep track of the insertion offset
              let insertPos = pos;

              for (const p of paths) {
                try {
                  const fileName = await basename(p);
                  
                  let assetsDir = '';
                  let markdownLink = '';

                  if (props.filePath) {
                    const currentDir = await dirname(props.filePath);
                    assetsDir = `${currentDir}/assets`;
                    markdownLink = `./assets/${fileName}`;
                  } else if (props.workspaceRoot) {
                    assetsDir = `${props.workspaceRoot}/assets`;
                    markdownLink = `./assets/${fileName}`;
                  } else {
                    continue;
                  }

                  try {
                    await mkdir(assetsDir, { recursive: true });
                  } catch (e) {
                    // Ignore if already exists
                  }

                  const targetPath = `${assetsDir}/${fileName}`;
                  await copyFile(p, targetPath);

                  const isImage = /\.(png|jpe?g|gif|svg|webp)$/i.test(fileName);
                  
                  let tr = view.state.tr;
                  if (isImage) {
                    const imageType = view.state.schema.nodes.image;
                    if (imageType) {
                      const node = imageType.create({ src: markdownLink, alt: fileName });
                      tr = tr.insert(insertPos, node);
                      insertPos += node.nodeSize;
                    }
                  } else {
                    const linkType = view.state.schema.marks.link;
                    if (linkType) {
                      const textNode = view.state.schema.text(fileName, [linkType.create({ href: markdownLink, title: fileName })]);
                      tr = tr.insert(insertPos, textNode);
                      insertPos += textNode.nodeSize;
                    }
                  }

                  const spaceNode = view.state.schema.text(' ');
                  tr = tr.insert(insertPos, spaceNode);
                  insertPos += 1;

                  view.dispatch(tr);
                } catch (err) {
                  console.error("Failed to copy dropped file:", err);
                }
              }
              view.focus();
            });
          }
        }
      }).then(fn => {
        if (!isMounted) {
          fn();
        } else {
          unlistenFn = fn;
        }
      }).catch(err => {
        console.warn("Failed to attach drag and drop event (likely not running in Tauri):", err);
      });
    } catch (err) {
      console.warn("Failed to get current webview (likely not running in Tauri):", err);
    }

    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, [get, props.filePath, props.workspaceRoot]);

  useImperativeHandle(ref, () => ({
    insertLink: (file) => {
      const editor = get();
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state, dispatch } = view;
        const linkText = `[${file.name.replace(/\.md$/, '')}](${file.path})`;
        const tr = state.tr.insertText(linkText, state.selection.from, state.selection.to);
        dispatch(tr);
        view.focus();
      });
    },
    scrollToHeader: (hash) => {
      const editor = get();
      if (!editor) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        let targetPos = -1;
        view.state.doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            const text = node.textContent;
            const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
            if (id === hash) {
              targetPos = pos;
              return false;
            }
          }
        });
        if (targetPos >= 0) {
          const dom = view.nodeDOM(targetPos);
          if (dom && dom instanceof HTMLElement) {
            dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    }
  }));

  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!props.onActiveHeadingChange) return;
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let activeId = '';
      for (let i = 0; i < headings.length; i++) {
        const el = headings[i] as HTMLElement;
        const rect = el.getBoundingClientRect();
        // If the heading is above or near the top of the container
        if (rect.top <= 200) {
          activeId = el.textContent?.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || '';
        } else {
          break; // Stop once we find a heading that is below our threshold
        }
      }
      
      // If we're very close to the top, we might not have triggered the first heading
      if (!activeId && headings.length > 0) {
        activeId = headings[0].textContent?.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || '';
      }
      
      props.onActiveHeadingChange(activeId);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    // Trigger once on mount
    handleScroll();
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [props.onActiveHeadingChange, props.initialContent]);

  return (
    <div ref={containerRef} className="milkdown-container" style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', overflowY: 'auto', outline: 'none' }}>
      <Milkdown />
      <FindReplace />
      <HoverPreview workspaceRoot={props.workspaceRoot || ''} />
      {props.children}
    </div>
  );
});

export const GladeEditor = forwardRef<EditorHandle, EditorProps>((props, ref) => {
  return (
    <MilkdownProvider>
      <ProsemirrorAdapterProvider>
        <MilkdownInner {...props} ref={ref} key={props.filePath} />
      </ProsemirrorAdapterProvider>
    </MilkdownProvider>
  );
});

export default GladeEditor;
