import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, ViewUpdate, keymap } from '@codemirror/view';
import { autocompletion, CompletionContext, CompletionResult, closeBrackets } from '@codemirror/autocomplete';
import { format, addDays, subDays } from 'date-fns';
import './Editor.css';

import { hoverTooltip } from '@codemirror/view';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';

interface EditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
  filePath: string;
  initialCursorPos?: number;
  onCursorChange?: (pos: number) => void;
  allFiles?: { name: string, path: string }[];
  onNavigate?: (filePath: string) => void;
  onCreateFile?: (fileName: string) => void;
  onRename?: (oldPath: string, newName: string) => void;
  children?: React.ReactNode;
}

import { useSettings } from '../utils/settings';

import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
// Imports moved or consolidated
import { tags as t } from '@lezer/highlight';
import { Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { GFM } from '@lezer/markdown';
import { marked } from 'marked';

class BulletWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  eq(other: BulletWidget) { return this.text === other.text; }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.text;
    span.className = "cm-bullet-widget";
    return span;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) { super(); }
  eq(other: CheckboxWidget) { return other.checked == this.checked; }
  toDOM() {
    const wrap = document.createElement("span");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.className = "cm-todo-checkbox";
    checkbox.style.marginRight = "8px";
    checkbox.style.verticalAlign = "middle";
    checkbox.style.cursor = "pointer";
    wrap.appendChild(checkbox);
    return wrap;
  }
  ignoreEvent() { return false; }
}



const checkboxInteraction = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement;
    if (target.classList.contains("cm-todo-checkbox")) {
      event.preventDefault(); // Prevent cursor from moving to the line
      const isChecked = !(target as HTMLInputElement).checked; // Toggle the state
      const pos = view.posAtDOM(target);
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos);
        const regex = /([-*+]\s)\[(x| |X)\]/i;
        const match = line.text.match(regex);
        if (match) {
          const matchIndex = match.index;
          const replaceFrom = line.from + matchIndex! + match[1].length + 1;
          const replaceTo = replaceFrom + 1;
          view.dispatch({
            changes: {
              from: replaceFrom,
              to: replaceTo,
              insert: isChecked ? "x" : " "
            }
          });
          return true;
        }
      }
    }
  }
});

const pasteHandler = EditorView.domEventHandlers({
  paste(event, view) {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return false;
    
    const text = clipboardData.getData('text/plain');
    if (!text) return false;

    try {
      new URL(text);
    } catch {
      return false; // Not a URL
    }

    const selection = view.state.selection.main;
    if (selection.empty) return false; // Nothing selected

    const selectedText = view.state.doc.sliceString(selection.from, selection.to);
    
    event.preventDefault();
    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: `[${selectedText}](${text})`
      },
      selection: { anchor: selection.from + selectedText.length + text.length + 4 }
    });
    return true;
  }
});

const dropHandler = EditorView.domEventHandlers({
  drop: (e, view) => {
    const data = e.dataTransfer?.getData('application/glade-file');
    if (data) {
      e.preventDefault();
      try {
        const file = JSON.parse(data);
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos !== null) {
          const isImage = file.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
          const linkText = isImage ? `![${file.name}](${file.path})` : `[${file.name.replace(/\.md$/, '')}](${file.path})`;
          view.dispatch({
            changes: { from: pos, insert: linkText },
            selection: { anchor: pos + linkText.length }
          });
          view.focus();
        }
      } catch (err) {
        console.error("Failed to parse dropped file", err);
      }
      return true;
    }
    return false;
  }
});

const typewriterScroll = EditorState.transactionExtender.of((tr) => {
  if (tr.docChanged && tr.selection) {
    return {
      effects: EditorView.scrollIntoView(tr.newSelection.main.head, { y: 'center' })
    };
  }
  return null;
});

class ImageWidget extends WidgetType {
  constructor(readonly url: string, readonly alt: string, readonly filePath: string) { super(); }
  eq(other: ImageWidget) { return other.url === this.url && other.alt === this.alt && other.filePath === this.filePath; }
  toDOM() {
    const wrap = document.createElement("span");
    const img = document.createElement("img");
    
    let absoluteUrl = this.url;
    if (!this.url.startsWith('http') && !this.url.startsWith('data:') && !this.url.startsWith('tauri://') && this.filePath) {
      const dir = this.filePath.substring(0, Math.max(this.filePath.lastIndexOf('/'), this.filePath.lastIndexOf('\\')));
      const isAbsolute = this.url.startsWith('/') || this.url.match(/^[a-zA-Z]:\\/);
      
      const normalizePath = (path: string) => {
        const isAbs = path.startsWith('/');
        const parts = path.split(/[/\\]/);
        const result: string[] = [];
        for (const part of parts) {
          if (part === '.' || part === '') continue;
          if (part === '..') {
            if (result.length > 0 && result[result.length - 1] !== '..') result.pop();
            else result.push('..');
          } else {
            result.push(part);
          }
        }
        return (isAbs ? '/' : '') + result.join('/');
      };
      
      const resolvedPath = isAbsolute ? this.url : normalizePath(`${dir}/${this.url}`);
      
      try {
        absoluteUrl = convertFileSrc(resolvedPath);
      } catch (e) {
        console.error("Failed to convert file src", e);
      }
    }
    
    img.src = absoluteUrl;
    img.alt = this.alt;
    img.className = "cm-image";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "400px";
    img.style.borderRadius = "4px";
    img.style.display = "block";
    img.style.margin = "8px 0";
    wrap.appendChild(img);
    
    return wrap;
  }
}



class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-hr";
    return hr;
  }
}

class TableWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  eq(other: TableWidget) { return other.text === this.text; }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.style.overflowX = "auto";
    wrap.style.margin = "16px 0";
    const table = document.createElement("table");
    table.className = "cm-table";
    
    const lines = this.text.trim().split('\n');
    let html = '';
    lines.forEach((line, i) => {
      if (i === 1 && line.match(/^[-|: ]+$/)) return;
      const isHeader = i === 0;
      const tag = isHeader ? 'th' : 'td';
      const cells = line.replace(/^\||\|$/g, '').split('|');
      const rowHtml = cells.map(c => {
        return `<${tag}>${c.trim()}</${tag}>`;
      }).join('');
      html += `<tr>${rowHtml}</tr>`;
    });
    table.innerHTML = html;
    wrap.appendChild(table);
    return wrap;
  }
}

const hideMarkDeco = Decoration.replace({});
const codeBlockLineDeco = Decoration.line({
  attributes: { class: "cm-codeblock-line" }
});
const danglingLinkDeco = Decoration.mark({ class: "cm-link-dangling" });

import { EditorState, StateField } from '@codemirror/state';

const buildDeco = (state: EditorState, filePath: string, validPaths: Set<string>) => {
  const marks: {from: number, to: number, type: string, widget?: WidgetType}[] = [];
  const selection = state.selection.main;
  const activeLine = state.doc.lineAt(selection.head);

  syntaxTree(state).iterate({
    enter: (node) => {
      const isActiveLine = node.from >= activeLine.from && node.from <= activeLine.to;
      const name = node.name;
      
      if (name === "Image") {
        if (!isActiveLine) {
          const text = state.doc.sliceString(node.from, node.to);
          const match = text.match(/!\[(.*?)\]\((.*?)\)/);
          if (match) {
            marks.push({from: node.from, to: node.to, type: "replace", widget: new ImageWidget(match[2], match[1], filePath)});
          }
        }
        return false;
      } else if (name === "HorizontalRule") {
        if (!isActiveLine) {
          const startLine = state.doc.lineAt(node.from);
          marks.push({from: startLine.from, to: startLine.to, type: "replace-block", widget: new HrWidget()});
        }
        return false;
      } else if (name === "Table") {
        if (!isActiveLine) {
          const text = state.doc.sliceString(node.from, node.to);
          const startLine = state.doc.lineAt(node.from);
          const endLine = state.doc.lineAt(node.to);
          marks.push({from: startLine.from, to: endLine.to, type: "replace-block", widget: new TableWidget(text)});
        }
        return false;
      } else if (name === "FencedCode") {
        let pos = node.from;
        while (pos <= node.to) {
          const line = state.doc.lineAt(pos);
          marks.push({from: line.from, to: line.from, type: "line"});
          pos = line.to + 1;
        }
      } else if (name === "TaskMarker") {
        if (!isActiveLine) {
          const text = state.doc.sliceString(node.from, node.to);
          const isChecked = text.toLowerCase() === "[x]" || text.toLowerCase() === "[X]";
          
          const line = state.doc.lineAt(node.from);
          let listMarkFrom = -1;
          syntaxTree(state).iterate({
            from: line.from,
            to: node.from,
            enter: (n) => {
              if (n.name === "ListMark") listMarkFrom = n.from;
            }
          });

          if (listMarkFrom !== -1) {
            marks.push({from: listMarkFrom, to: node.to, type: "replace", widget: new CheckboxWidget(isChecked)});
          }
        }
      } else if (name === "ListMark") {
        if (!isActiveLine) {
          const line = state.doc.lineAt(node.from);
          let hasTask = false;
          syntaxTree(state).iterate({
            from: node.to,
            to: line.to,
            enter: (n) => {
              if (n.name === "TaskMarker") hasTask = true;
            }
          });

          if (!hasTask) {
            const text = state.doc.sliceString(node.from, node.to);
            if (/^[-*+]\s*$/.test(text)) {
              marks.push({
                from: node.from, 
                to: node.to, 
                type: "replace", 
                widget: new BulletWidget(text.replace(/[-*+]/, "•"))
              });
            }
          }
        }
      }

      if (isActiveLine) return;

      if (
        name === "HeaderMark" ||
        name === "EmphasisMark" ||
        name === "CodeMark" ||
        name === "QuoteMark" ||
        name === "LinkMark" ||
        (name === "URL" && node.node.parent?.name === "Link")
      ) {
        marks.push({from: node.from, to: node.to, type: "hide"});
      } else if (name === "Link") {
        const text = state.doc.sliceString(node.from, node.to);
        const match = text.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          let linkTarget = match[2].split('#')[0]; // Strip hash
          // check if dangling
          if (linkTarget && !linkTarget.startsWith('http') && !linkTarget.startsWith('data:') && !linkTarget.startsWith('tauri://')) {
            let absPath = linkTarget;
            if (!absPath.startsWith('/')) {
                const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
                const parts = `${dir}/${absPath}`.split(/[/\\]/);
                const res: string[] = [];
                for (const p of parts) {
                    if (p === '.' || p === '') continue;
                    if (p === '..') { if(res.length && res[res.length-1] !== '..') res.pop(); else res.push('..'); }
                    else res.push(p);
                }
                absPath = '/' + res.join('/');
            }
            if (!validPaths.has(absPath)) {
               marks.push({from: node.from, to: node.to, type: "mark-dangling"});
            }
          }
        }
      }
    }
  });

  const decorations = marks.map(mark => {
    if (mark.type === "line") {
      return codeBlockLineDeco.range(mark.from, mark.from);
    } else if (mark.type === "hide") {
      return hideMarkDeco.range(mark.from, mark.to);
    } else if (mark.type === "replace" && mark.widget) {
      return Decoration.replace({ widget: mark.widget }).range(mark.from, mark.to);
    } else if (mark.type === "replace-block" && mark.widget) {
      return Decoration.replace({ widget: mark.widget, block: true }).range(mark.from, mark.to);
    } else if (mark.type === "mark-dangling") {
      return danglingLinkDeco.range(mark.from, mark.to);
    }
    return null;
  }).filter((d): d is any => d !== null);

  // Use Decoration.set which automatically sorts and handles overlapping marks safely
  return Decoration.set(decorations, true);
};

const getLinkHoverTooltip = (filePath: string, validPaths: Set<string>) => hoverTooltip(async (view, pos) => {
  const tree = syntaxTree(view.state);
  let isLink = false;
  let linkUrl = "";
  let tooltipFrom = pos, tooltipTo = pos;

  tree.iterate({
    from: pos, to: pos,
    enter: (node) => {
      if (node.name === "Link" || node.name === "URL") {
        let n: any = node.node;
        if (n.name === "URL") {
          n = n.parent;
        }
        if (n?.name === "Link") {
          const urlNode = n.getChild("URL");
          if (urlNode) {
              const doc = view.state.doc.sliceString(n.from, n.to);
              const match = doc.match(/\[(.*?)\]\((.*?)\)/);
              if (match) {
                 linkUrl = match[2];
                 isLink = true;
                 tooltipFrom = n.from;
                 tooltipTo = n.to;
              }
          }
        }
      }
    }
  });

  if (!isLink || !linkUrl) return null;

  let linkTarget = linkUrl.split('#')[0];
  let isExternal = linkTarget.startsWith('http') || linkTarget.startsWith('data:') || linkTarget.startsWith('tauri://');

  let absPath = linkTarget;
  if (!isExternal) {
    if (!absPath.startsWith('/')) {
        const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
        const parts = `${dir}/${absPath}`.split(/[/\\]/);
        const res: string[] = [];
        for (const p of parts) {
            if (p === '.' || p === '') continue;
            if (p === '..') { if(res.length && res[res.length-1] !== '..') res.pop(); else res.push('..'); }
            else res.push(p);
        }
        absPath = '/' + res.join('/');
    }
  }

  return {
    pos: tooltipFrom,
    end: tooltipTo,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-link-preview-tooltip";
      dom.style.padding = "10px";
      dom.style.maxWidth = "400px";
      dom.style.maxHeight = "300px";
      dom.style.overflow = "hidden";
      dom.style.backgroundColor = "var(--background-secondary)";
      dom.style.border = "1px solid var(--background-modifier-border)";
      dom.style.borderRadius = "8px";
      dom.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      dom.style.color = "var(--text-normal)";
      dom.style.fontSize = "14px";
      dom.style.whiteSpace = "pre-wrap";

      if (isExternal) {
         const link = document.createElement("a");
         link.href = linkTarget;
         link.target = "_blank";
         link.style.color = "var(--text-accent)";
         link.textContent = linkTarget;
         dom.innerHTML = `<strong style="display:block;margin-bottom:8px;">External Link</strong>`;
         dom.appendChild(link);
      } else {
         if (validPaths.has(absPath)) {
            dom.textContent = "Loading preview...";
            readTextFile(absPath).then(async content => {
               const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
               try {
                 const htmlPreview = await marked.parse(preview);
                 dom.innerHTML = `<strong style="display:block;margin-bottom:8px;border-bottom:1px solid var(--background-modifier-border);padding-bottom:4px;">${absPath.split('/').pop()}</strong><div style="color: var(--text-normal); font-size: 13px;">${htmlPreview}</div>`;
               } catch (e) {
                 dom.innerHTML = `<strong style="display:block;margin-bottom:8px;border-bottom:1px solid var(--background-modifier-border);padding-bottom:4px;">${absPath.split('/').pop()}</strong><div style="color: var(--text-muted); font-size: 13px;">${preview}</div>`;
               }
            }).catch(() => {
               dom.textContent = "Error loading preview.";
            });
         } else {
            dom.textContent = "File not found.";
         }
      }
      
      return { dom };
    }
  };
});

const getLivePreviewField = (filePath: string, validPaths: Set<string>) => StateField.define<DecorationSet>({
  create(state) {
    return buildDeco(state, filePath, validPaths);
  },
  update(deco, tr) {
    if (tr.docChanged || tr.selection) {
      return buildDeco(tr.state, filePath, validPaths);
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f)
});



// A custom theme to make CodeMirror blend in with our Obsidian-like UI
const gladeTheme = EditorView.theme({
  "&": {
    color: "var(--text-normal)",
    backgroundColor: "var(--background-primary)",
    height: "100%",
    fontSize: "16px",
    fontFamily: "var(--font-text)",
    lineHeight: "1.6",
  },
  ".cm-content": {
    padding: "40px",
    maxWidth: "800px",
    margin: "0 auto",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-text)",
    scrollbarGutter: "stable",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--text-normal)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--background-modifier-active-hover)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--background-primary)",
    color: "var(--text-faint)",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--text-normal)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--background-modifier-hover)",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-link-dangling": {
    color: "var(--text-error, #f87171) !important",
    textDecoration: "underline wavy var(--text-error, #f87171) !important"
  }
}, { dark: false });

// Markdown specific syntax highlighting to make it look like a rich document
const markdownHighlighting = HighlightStyle.define([
  { tag: t.heading1, fontSize: "2.2em", fontWeight: "700", color: "var(--text-normal)", margin: "24px 0 12px 0" },
  { tag: t.heading2, fontSize: "1.8em", fontWeight: "600", color: "var(--text-normal)", margin: "20px 0 10px 0" },
  { tag: t.heading3, fontSize: "1.5em", fontWeight: "600", color: "var(--text-normal)", margin: "16px 0 8px 0" },
  { tag: t.heading4, fontSize: "1.2em", fontWeight: "600", color: "var(--text-normal)", margin: "12px 0 8px 0" },
  { tag: t.heading5, fontSize: "1.1em", fontWeight: "600", color: "var(--text-normal)" },
  { tag: t.heading6, fontSize: "1em", fontWeight: "600", color: "var(--text-muted)" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--interactive-accent)", textDecoration: "underline" },
  { tag: t.url, color: "var(--interactive-accent)", textDecoration: "underline" },
  { tag: t.quote, borderLeft: "3px solid var(--interactive-accent)", paddingLeft: "12px", color: "var(--text-muted)", fontStyle: "italic" },
  { tag: t.monospace, fontFamily: "var(--font-monospace)", backgroundColor: "var(--background-modifier-hover)", padding: "2px 4px", borderRadius: "4px", fontSize: "0.9em" },
  { tag: t.comment, color: "var(--text-faint)", fontStyle: "italic" },
  { tag: t.list, color: "var(--text-normal)" },
]);


export interface EditorHandle {
  insertLink: (file: { name: string, path: string }) => void;
  scrollToHeader: (hash: string) => void;
}

export const Editor = React.forwardRef<EditorHandle, EditorProps>(({ initialContent, onSave, fileName, filePath, initialCursorPos, onCursorChange, allFiles, onNavigate, onCreateFile, onRename, children }, ref) => {
  const { settings } = useSettings();
  const [content, setContent] = useState(initialContent);
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  const startEditingTitle = () => {
    setIsEditingTitle(true);
    setEditTitle(fileName.replace(/\.md$/, ''));
  };

  const submitTitleEdit = () => {
    setIsEditingTitle(false);
    if (editTitle && editTitle !== fileName.replace(/\.md$/, '') && onRename) {
      onRename(filePath, editTitle);
    }
  };

  const scrollToHeader = React.useCallback((hash: string) => {
    if (!editorView) return;
    const targetHash = hash.replace(/^#/, '').toLowerCase();
    const doc = editorView.state.doc.toString();
    const regex = /^(#{1,6})\s+(.*)$/gm;
    let match;
    while ((match = regex.exec(doc)) !== null) {
       const headingText = match[2];
       const headingId = headingText.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
       if (headingId === targetHash || headingText.toLowerCase() === targetHash) {
          editorView.dispatch({
             selection: { anchor: match.index },
             scrollIntoView: true
          });
          editorView.focus();
          break;
       }
    }
  }, [editorView]);

  React.useImperativeHandle(ref, () => ({
    insertLink: (file: { name: string, path: string }) => {
      if (!editorView) return;
      const selection = editorView.state.selection.main;
      let selectedText = editorView.state.doc.sliceString(selection.from, selection.to);
      if (!selectedText) selectedText = file.name.replace(/\.md$/, '');
      const linkText = `[${selectedText}](${file.path})`;
      
      editorView.dispatch({
        changes: { from: selection.from, to: selection.to, insert: linkText },
        selection: { anchor: selection.from + linkText.length }
      });
      editorView.focus();
    },
    scrollToHeader
  }));


  const { livePreviewField, linkHoverTooltip } = React.useMemo(() => {
    const validPaths = new Set((allFiles || []).map(f => f.path));
    return {
      livePreviewField: getLivePreviewField(filePath, validPaths),
      linkHoverTooltip: getLinkHoverTooltip(filePath, validPaths)
    };
  }, [filePath, allFiles]);

  const linkClickHandler = React.useMemo(() => {
    return EditorView.domEventHandlers({
      mousedown(event, view) {
        if (event.metaKey || event.ctrlKey) {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos !== null) {
            const line = view.state.doc.lineAt(pos);
            const text = line.text;
            const offset = pos - line.from;

            let linkUrl: string | null = null;
            let isLocal = false;

            // Check for standard markdown link [text](url)
            const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            let match;
            while ((match = mdLinkRegex.exec(text)) !== null) {
              if (offset >= match.index && offset <= match.index + match[0].length) {
                linkUrl = match[2];
                isLocal = !linkUrl.match(/^(http|https|mailto):/i);
                break;
              }
            }

            // Check for wiki link [[url]]
            if (!linkUrl) {
              const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
              while ((match = wikiLinkRegex.exec(text)) !== null) {
                if (offset >= match.index && offset <= match.index + match[0].length) {
                  linkUrl = match[1];
                  isLocal = true;
                  break;
                }
              }
            }

            if (linkUrl) {
              event.preventDefault();
              if (isLocal) {
                if (onNavigate) onNavigate(linkUrl);
              } else {
                import('@tauri-apps/plugin-opener').then(module => {
                  module.openUrl(linkUrl!);
                }).catch(err => {
                  console.error("Failed to load plugin-opener:", err);
                });
              }
              return true;
            }
          }
        }
        return false;
      }
    });
  }, [onNavigate, onCreateFile]);

  // When initialContent changes (e.g., file switched), update local state
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const linkCompletionSource = React.useCallback(async (context: CompletionContext): Promise<CompletionResult | null> => {
    let word = context.matchBefore(/\[\[[^\]]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;

    const query = word.text.slice(2);
    if (query.includes('#')) {
       const [fileName] = query.split('#');
       const targetFile = (allFiles || []).find(f => f.name.replace(/\.md$/, '') === fileName || f.path === fileName);
       if (targetFile) {
          try {
             const content = await readTextFile(targetFile.path);
             const regex = /^(#{1,6})\s+(.*)$/gm;
             let match;
             const options = [];
             while ((match = regex.exec(content)) !== null) {
                const headingText = match[2];
                options.push({
                   label: headingText,
                   type: "property",
                   apply: `[${fileName} > ${headingText}](${targetFile.path}#${headingText.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')})`
                });
             }
             return {
                from: word.from,
                options
             };
          } catch(e) {
             return null;
          }
       }
    }

    return {
      from: word.from + 2,
      options: (allFiles || []).map(f => ({
        label: f.name.replace(/\.md$/, ''),
        type: "text",
        apply: `[${f.name.replace(/\.md$/, '')}](${f.path})`
      }))
    };
  }, [allFiles]);

  const macroCompletionSource = React.useCallback(async (context: CompletionContext): Promise<CompletionResult | null> => {
    let word = context.matchBefore(/@[^ ]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;

    const query = word.text.slice(1);
    if (query.includes('#')) {
       const [fileName] = query.split('#');
       const targetFile = (allFiles || []).find(f => f.name.replace(/\.md$/, '') === fileName || f.path === fileName);
       if (targetFile) {
          try {
             const content = await readTextFile(targetFile.path);
             const regex = /^(#{1,6})\s+(.*)$/gm;
             let match;
             const options = [];
             while ((match = regex.exec(content)) !== null) {
                const headingText = match[2];
                options.push({
                   label: headingText,
                   type: "property",
                   apply: `[${fileName} > ${headingText}](${targetFile.path}#${headingText.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')})`
                });
             }
             return {
                from: word.from,
                options
             };
          } catch(e) {
             return null;
          }
       }
    }

    const today = new Date();
    const macros = [
      { label: "@today", type: "keyword", apply: format(today, 'yyyy-MM-dd') },
      { label: "@tomorrow", type: "keyword", apply: format(addDays(today, 1), 'yyyy-MM-dd') },
      { label: "@yesterday", type: "keyword", apply: format(subDays(today, 1), 'yyyy-MM-dd') },
      { label: "@now", type: "keyword", apply: format(today, 'HH:mm:ss') }
    ];

    const fileOptions = (allFiles || []).map(f => ({
      label: `@${f.name.replace(/\.md$/, '')}`,
      type: "text",
      apply: `[${f.name.replace(/\.md$/, '')}](${f.path})`
    }));

    return {
      from: word.from,
      options: [...macros, ...fileOptions]
    };
  }, [allFiles]);

  const handleChange = (val: string) => {
    setContent(val);
    // Debounce save in a real app, but for MVP we can save on blur or with a short timeout.
    // For now, let's just trigger save on change (might be expensive)
    onSave(val); 
  };

  const handleCreateEditor = (view: EditorView) => {
    setEditorView(view);
    if (initialCursorPos !== undefined) {
      // Ensure the cursor position doesn't exceed document length
      const pos = Math.min(initialCursorPos, view.state.doc.length);
      view.dispatch({ selection: { anchor: pos } });
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
    } else {
      // Default to end of document
      const pos = view.state.doc.length;
      view.dispatch({ selection: { anchor: pos } });
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
    }
  };

  const handleUpdate = (viewUpdate: ViewUpdate) => {
    if (viewUpdate.selectionSet && onCursorChange) {
      onCursorChange(viewUpdate.state.selection.main.head);
    }
  };

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <div className="editor-header-inner">
          {isEditingTitle ? (
            <input 
              autoFocus
              className="file-name editor-title-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={submitTitleEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  setEditTitle(fileName.replace(/\.md$/, ''));
                  setIsEditingTitle(false);
                }
              }}
              style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none', fontSize: 'inherit', fontWeight: 'inherit', width: `${Math.max(editTitle.length, 5)}ch` }}
            />
          ) : (
            <span className="file-name" onClick={startEditingTitle} style={{ cursor: 'text' }}>
              {fileName.replace(/\.md$/, '')}
            </span>
          )}
        </div>
      </div>
      <div className="editor-scroll-area">
        <CodeMirror
          className="cm-outer-wrapper"
          value={content}
          height="100%"
          extensions={[
            markdown({ base: markdownLanguage, codeLanguages: languages, extensions: [GFM] }),
            gladeTheme,
            syntaxHighlighting(markdownHighlighting),
            checkboxInteraction,
            pasteHandler,
            dropHandler,
            typewriterScroll,
            livePreviewField,
            linkHoverTooltip,
            linkClickHandler,
            closeBrackets(),
            autocompletion({ override: [linkCompletionSource, macroCompletionSource] }),
            keymap.of([
              { key: "Enter", run: insertNewlineContinueMarkup },
              { key: "Backspace", run: deleteMarkupBackward },
              {
                key: "Mod-k",
                run: (view) => {
                  const selection = view.state.selection.main;
                  const selectedText = view.state.sliceDoc(selection.from, selection.to);
                  view.dispatch({
                    changes: { from: selection.from, to: selection.to, insert: `[${selectedText}]()` },
                    selection: { anchor: selection.from + selectedText.length + 3 } // position inside ()
                  });
                  return true;
                }
              }
            ]),
            ...(settings.wordWrap ? [EditorView.lineWrapping] : [])
          ]}
          onChange={handleChange}
          onCreateEditor={handleCreateEditor}
          onUpdate={handleUpdate}
          basicSetup={{
            lineNumbers: settings.lineNumbers,
            foldGutter: true,
            highlightActiveLine: true,
          }}
        />
        {children}
      </div>
    </div>
  );
});

export default Editor;
