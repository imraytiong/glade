import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { ProsemirrorAdapterProvider, usePluginViewFactory, useNodeViewFactory } from '@prosemirror-adapter/react';
import { commonmark, imageSchema } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { tooltipFactory } from '@milkdown/plugin-tooltip';
import { slashFactory } from '@milkdown/plugin-slash';
import { prism } from '@milkdown/plugin-prism';
import { trailing } from '@milkdown/plugin-trailing';
import { indent } from '@milkdown/plugin-indent';

import { Tooltip } from './Tooltip';
import { LinkTooltip } from './LinkTooltip';
import { Slash } from './Slash';
import { WikiLink } from './WikiLink';
import { EmojiPicker } from './EmojiPicker';
import { FindReplace } from './FindReplace';
import { HoverPreview } from './HoverPreview';
import { CustomImage } from './CustomImage';
// import { remarkFrontmatterPlugin, yamlNode, FrontmatterNode } from './FrontmatterNode';
import { search } from 'prosemirror-search';

import { emoji } from '@milkdown/plugin-emoji';
import { cursor } from '@milkdown/plugin-cursor';
import { $prose, $view } from '@milkdown/utils';
import { Plugin } from '@milkdown/prose/state';
import 'prismjs/themes/prism-tomorrow.css';
import 'katex/dist/katex.min.css';
import './Editor.css'; // Keep the import, we'll rewrite the CSS file later

export interface EditorHandle {
  insertLink: (file: { name: string, path: string }) => void;
  scrollToHeader: (hash: string) => void;
}

interface EditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
  filePath: string;
  workspaceRoot?: string; // Passed from parent
  initialCursorPos?: number;
  onCursorChange?: (pos: number) => void;
  onActiveHeadingChange?: (id: string) => void;
  allFiles?: { name: string, path: string }[];
  onNavigate?: (filePath: string) => void;
  onCreateFile?: (fileName: string) => void;
  onRename?: (oldPath: string, newName: string) => void;
  onStatsChange?: (stats: { wordCount: number, charCount: number, readingTime: number }) => void;
  children?: React.ReactNode;
}

const tooltipPlugin = tooltipFactory('TOOLTIP');
const linkTooltipPlugin = tooltipFactory('LINK_TOOLTIP');
const slashPlugin = slashFactory('SLASH');
const wikiLinkPlugin = slashFactory('WIKILINK');
const emojiPickerPlugin = slashFactory('EMOJIPICKER');

const dragDropFixPlugin = $prose(() => new Plugin({
  props: {
    handleDOMEvents: {
      dragover(_view, event) {
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
        return false;
      }
    }
  }
}));

const searchPlugin = $prose(() => search());

const MilkdownInner = forwardRef<EditorHandle, EditorProps>((props, ref) => {
  const pluginViewFactory = usePluginViewFactory();
  const nodeViewFactory = useNodeViewFactory();

  const customImageView = React.useMemo(() => {
    return $view(imageSchema.node, () => nodeViewFactory({ 
      component: () => <CustomImage workspaceRoot={props.workspaceRoot} filePath={props.filePath} /> 
    }));
  }, [nodeViewFactory, props.workspaceRoot, props.filePath]);

  // const frontmatterView = React.useMemo(() => {
  //   return $view(yamlNode, () => nodeViewFactory({
  //     component: FrontmatterNode,
  //     as: 'div'
  //   }));
  // }, [nodeViewFactory]);

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, props.initialContent);
        
        ctx.set(tooltipPlugin.key, {
          view: pluginViewFactory({
            component: Tooltip
          })
        });

        ctx.set(linkTooltipPlugin.key, {
          view: pluginViewFactory({
            component: LinkTooltip
          })
        });
        
        ctx.set(slashPlugin.key, {
          view: pluginViewFactory({
            component: Slash
          })
        });

        ctx.set(wikiLinkPlugin.key, {
          view: pluginViewFactory({
            component: () => <WikiLink workspaceRoot={props.workspaceRoot || ''} />
          })
        });

        ctx.set(emojiPickerPlugin.key, {
          view: pluginViewFactory({
            component: EmojiPicker
          })
        });

        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            props.onSave(markdown);
          }
        });

        const computeStats = (text: string) => {
          const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
          const charCount = text.length;
          const readingTime = wordCount / 200; // Keep it as a float so StatusBar can Math.ceil it if it wants, or we can Math.ceil it here.
          if (props.onStatsChange) {
            props.onStatsChange({ wordCount, charCount, readingTime });
          }
        };

        ctx.get(listenerCtx).mounted((ctx) => {
          const text = ctx.get(editorViewCtx).state.doc.textContent;
          computeStats(text);
        });

        ctx.get(listenerCtx).updated((_ctx, doc, prevDoc) => {
          if (doc !== prevDoc) {
             computeStats(doc.textContent);
          }
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .use(tooltipPlugin)
      .use(linkTooltipPlugin)
      .use(slashPlugin)
      .use(wikiLinkPlugin)
      .use(emojiPickerPlugin)
      .use(searchPlugin)
      .use(prism)
      .use(trailing)
      .use(indent)
      .use(dragDropFixPlugin)
      .use(customImageView)
      // .use(remarkFrontmatterPlugin)
      // .use(yamlNode)
      // .use(frontmatterView)
      .use(emoji)
      .use(cursor)
  );

  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | undefined;
    
    import('@tauri-apps/api/webview').then(({ getCurrentWebview }) => {
      getCurrentWebview().onDragDropEvent((event) => {
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
              
              const { copyFile, mkdir } = await import('@tauri-apps/plugin-fs');
              const { basename, dirname } = await import('@tauri-apps/api/path');

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
      });
    });

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
