import React from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { useEditor } from '@milkdown/react';
import { usePluginViewFactory, useNodeViewFactory } from '@prosemirror-adapter/react';
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
import { CustomImage } from './CustomImage';
import { AgentPrompt } from './AgentPrompt';
import { search } from 'prosemirror-search';

import { emoji } from '@milkdown/plugin-emoji';
import { cursor } from '@milkdown/plugin-cursor';
import { $prose, $view } from '@milkdown/utils';
import { Plugin } from '@milkdown/prose/state';

const tooltipPlugin = tooltipFactory('TOOLTIP');
const linkTooltipPlugin = tooltipFactory('LINK_TOOLTIP');
const slashPlugin = slashFactory('SLASH');
const wikiLinkPlugin = slashFactory('WIKILINK');
const emojiPickerPlugin = slashFactory('EMOJIPICKER');
const agentSlashPlugin = slashFactory('AGENT_SLASH');

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

export interface EditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
  filePath: string;
  workspaceRoot?: string;
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

export function useGladeEditor(props: EditorProps) {
  const pluginViewFactory = usePluginViewFactory();
  const nodeViewFactory = useNodeViewFactory();
  const propsRef = React.useRef(props);

  React.useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const customImageView = React.useMemo(() => {
    return $view(imageSchema.node, () => nodeViewFactory({ 
      component: () => <CustomImage workspaceRoot={props.workspaceRoot} filePath={props.filePath} /> 
    }));
  }, [nodeViewFactory, props.workspaceRoot, props.filePath]);

  return useEditor((root) =>
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

        ctx.set(agentSlashPlugin.key, {
          view: pluginViewFactory({
            component: AgentPrompt
          })
        });

        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            propsRef.current.onSave(markdown);
          }
        });

        const computeStats = (text: string) => {
          const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
          const charCount = text.length;
          const readingTime = wordCount / 200;
          if (propsRef.current.onStatsChange) {
            propsRef.current.onStatsChange({ wordCount, charCount, readingTime });
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
      .use(agentSlashPlugin)
      .use(searchPlugin)
      .use(prism)
      .use(trailing)
      .use(indent)
      .use(dragDropFixPlugin)
      .use(customImageView)
      .use(emoji)
      .use(cursor)
  );
}
