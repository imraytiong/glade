import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage, insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, ViewUpdate, keymap, drawSelection } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, standardKeymap } from '@codemirror/commands';
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

import { HighlightStyle, syntaxHighlighting, syntaxTree, Language } from '@codemirror/language';
// Imports moved or consolidated
import { tags as t } from '@lezer/highlight';
import { Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { GFM } from '@lezer/markdown';
import { marked } from 'marked';
import matter from 'gray-matter';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import mermaid from 'mermaid';

const customMarkdownParser = markdownLanguage.parser.configure({
  remove: ["SetextHeading"]
});
const customMarkdownLanguage = new Language(markdownLanguage.data, customMarkdownParser, markdownLanguage.extensions);
import { search, searchKeymap } from '@codemirror/search';
import { Code, Edit2, BookOpen } from 'lucide-react';

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

const getMarkedOptions = (filePath: string) => {
  const renderer = new marked.Renderer();

  renderer.image = ({ href, title, text }) => {
    let absoluteUrl = href;
    if (href && !href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('tauri://') && filePath) {
      const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
      const isAbsolute = href.startsWith('/') || href.match(/^[a-zA-Z]:\\/);
      
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
      
      const resolvedPath = isAbsolute ? href : normalizePath(`${dir}/${href}`);
      
      try {
        absoluteUrl = convertFileSrc(resolvedPath);
      } catch (e) {}
    }
    return `<img src="${absoluteUrl}" alt="${text || ''}" title="${title || ''}" style="max-width: 100%; border-radius: 4px; margin: 8px 0;" />`;
  };

  renderer.code = ({ text, lang }) => {
    if (lang === 'mermaid') {
      return `<div class="mermaid">${text}</div>`;
    }
    const validLang = lang && Prism.languages[lang as string] ? (lang as string) : 'markup';
    const highlighted = Prism.highlight(text, Prism.languages[validLang], validLang);
    return `<pre><code class="language-${lang || 'markup'}">${highlighted}</code></pre>`;
  };

  return {
    renderer,
    gfm: true,
    breaks: true,
  };
};


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
  if (tr.docChanged || (tr.selection && tr.newSelection.main.empty)) {
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

class CodeLanguageWidget extends WidgetType {
  constructor(readonly lang: string, readonly pos: number) { super(); }
  eq(other: CodeLanguageWidget) { return other.lang === this.lang && other.pos === this.pos; }
  ignoreEvent(event: Event) { 
     // Don't ignore change events, but do ignore clicks so they don't focus the editor behind it
     if (event.type === 'change' || event.type === 'mousedown') return false;
     return true; 
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-code-language-selector";
    wrap.style.display = "flex";
    wrap.style.justifyContent = "flex-end";
    wrap.style.padding = "4px 8px";
    wrap.style.backgroundColor = "var(--background-modifier-hover)";
    wrap.style.borderTopLeftRadius = "4px";
    wrap.style.borderTopRightRadius = "4px";
    wrap.style.borderBottom = "1px solid var(--background-modifier-border)";
    wrap.style.userSelect = "none";
    
    const select = document.createElement("select");
    select.className = "cm-code-lang-select";
    select.style.background = "var(--background-primary)";
    select.style.color = "var(--text-normal)";
    select.style.border = "1px solid var(--background-modifier-border)";
    select.style.borderRadius = "4px";
    select.style.padding = "2px 8px";
    select.style.fontSize = "12px";
    select.style.cursor = "pointer";
    select.style.outline = "none";
    
    const options = ["auto", "javascript", "typescript", "python", "json", "bash", "html", "css", "markdown", "rust", "go", "java", "c", "cpp"];
    options.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.text = opt.charAt(0).toUpperCase() + opt.slice(1);
      if (opt === this.lang.toLowerCase()) option.selected = true;
      select.appendChild(option);
    });
    
    // We add an explicit event listener instead of onchange for better compatibility with CodeMirror's event bubbling
    select.addEventListener('change', (e) => {
      const newLang = (e.target as HTMLSelectElement).value;
      const line = view.state.doc.lineAt(this.pos);
      const match = line.text.match(/^(\s*```+)\s*(.*)$/);
      if (match) {
        const fenceLen = match[1].length;
        view.dispatch({
          changes: { from: line.from + fenceLen, to: line.to, insert: newLang === 'auto' ? '' : newLang }
        });
      }
    });

    // Prevent mousedown from propagating to the editor so the dropdown opens properly
    select.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    
    wrap.appendChild(select);
    return wrap;
  }
}

class TableWidget extends WidgetType {
  constructor(readonly text: string, readonly pos: number) { super(); }
  eq(other: TableWidget) { return other.text === this.text && other.pos === this.pos; }
  ignoreEvent(event: Event) { 
    return true; // Let the widget handle its own DOM events
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.style.overflowX = "auto";
    wrap.style.margin = "16px 0";
    wrap.style.position = "relative";
    wrap.style.border = "1px solid var(--background-modifier-border)";
    wrap.style.borderRadius = "8px";
    wrap.style.padding = "8px";
    wrap.style.backgroundColor = "var(--background-primary)";
    
    const table = document.createElement("table");
    table.className = "cm-table";
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    
    let lines = this.text.trim().split('\n');
    if (lines.length < 2) {
       lines = ["| Header |", "|---|"];
    }
    const parseRow = (line: string) => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    let header = parseRow(lines[0]);
    let alignments = parseRow(lines[1]);
    let rows = lines.slice(2).map(parseRow);
    
    // Ensure all rows have same length as header
    rows = rows.map(r => {
      while (r.length < header.length) r.push('');
      return r.slice(0, header.length);
    });

    const serializeAndDispatch = () => {
      let newText = `| ${header.join(' | ')} |\n| ${alignments.join(' | ')} |`;
      if (rows.length > 0) {
        newText += '\n' + rows.map(r => `| ${r.join(' | ')} |`).join('\n');
      }
      view.dispatch({
        changes: { from: this.pos, to: this.pos + this.text.length, insert: newText }
      });
    };

    const render = () => {
      table.innerHTML = '';
      
      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      header.forEach((cell, i) => {
        const th = document.createElement('th');
        th.contentEditable = "true";
        th.innerText = cell;
        th.style.border = "1px solid var(--background-modifier-border)";
        th.style.padding = "6px 12px";
        th.style.background = "var(--background-secondary)";
        th.addEventListener('blur', (e) => {
          if (header[i] !== th.innerText) {
             header[i] = th.innerText.replace(/\n/g, ' ');
             serializeAndDispatch();
          }
        });
        th.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); th.blur(); }
        });
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);
      
      const tbody = document.createElement('tbody');
      rows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        row.forEach((cell, colIndex) => {
          const td = document.createElement('td');
          td.contentEditable = "true";
          td.innerText = cell;
          td.style.border = "1px solid var(--background-modifier-border)";
          td.style.padding = "6px 12px";
          td.addEventListener('blur', (e) => {
            if (rows[rowIndex][colIndex] !== td.innerText) {
               rows[rowIndex][colIndex] = td.innerText.replace(/\n/g, ' ');
               serializeAndDispatch();
            }
          });
          td.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); td.blur(); }
          });
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    };
    
    render();
    wrap.appendChild(table);
    
    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.marginTop = "8px";
    
    const btnRow = document.createElement("button");
    btnRow.innerText = "+ Row";
    btnRow.className = "cm-table-btn";
    btnRow.style.fontSize = "12px";
    btnRow.style.padding = "4px 8px";
    btnRow.style.cursor = "pointer";
    btnRow.onclick = (e) => {
      e.preventDefault();
      rows.push(new Array(header.length).fill(''));
      serializeAndDispatch();
    };
    
    const btnCol = document.createElement("button");
    btnCol.innerText = "+ Col";
    btnCol.className = "cm-table-btn";
    btnCol.style.fontSize = "12px";
    btnCol.style.padding = "4px 8px";
    btnCol.style.cursor = "pointer";
    btnCol.onclick = (e) => {
      e.preventDefault();
      header.push('Header');
      alignments.push('---');
      rows.forEach(r => r.push(''));
      serializeAndDispatch();
    };
    
    controls.appendChild(btnRow);
    controls.appendChild(btnCol);
    wrap.appendChild(controls);
    
    return wrap;
  }
}

class HiddenMarkupWidget extends WidgetType {
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-hidden-markup";
    return el;
  }
}

class EscapeWidget extends WidgetType {
  constructor(readonly char: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.char;
    return span;
  }
}

const hideMarkDeco = Decoration.replace({ widget: new HiddenMarkupWidget() });

const disableFormattingInputHandler = EditorView.inputHandler.of((view, from, to, text) => {
  // Always escape inline formatting triggers immediately anywhere
  if (['*', '_', '~', '`'].includes(text)) {
    view.dispatch({
      changes: { from, to, insert: `\\${text}` },
      selection: { anchor: from + 2 }
    });
    return true;
  }

  // Escape block formatting triggers immediately if they are typed at the start of a line.
  // We only need to escape the very first character to break the block formatting parser.
  if (['#', '>'].includes(text)) {
    const line = view.state.doc.lineAt(from);
    const linePrefix = view.state.sliceDoc(line.from, from);
    
    // Only escape if it's the very first character of the line (ignoring leading whitespace)
    if (linePrefix.trim() === '') {
      view.dispatch({
        changes: { from, to, insert: `\\${text}` },
        selection: { anchor: from + 2 }
      });
      return true;
    }
  }

  // Escape ordered lists by escaping the dot immediately
  if (text === '.') {
    const line = view.state.doc.lineAt(from);
    const linePrefix = view.state.sliceDoc(line.from, from);
    if (/^\d+$/.test(linePrefix)) {
      view.dispatch({
        changes: { from, to, insert: `\\.` },
        selection: { anchor: from + 2 }
      });
      return true;
    }
  }

  return false;
});

const codeBlockLineDeco = Decoration.line({
  attributes: { class: "cm-codeblock-line" }
});
const danglingLinkDeco = Decoration.mark({ class: "cm-link-dangling" });

import { EditorState, StateEffect, StateField, RangeSetBuilder, Extension, Text, Transaction } from '@codemirror/state';

export const toggleMarkupEffect = StateEffect.define<void>();

export const exposeMarkupField = StateField.define<boolean>({
  create() { return false; },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(toggleMarkupEffect)) return !value;
    }
    return value;
  }
});

const buildDeco = (state: EditorState, filePath: string, validPaths: Set<string>) => {
  const exposeMarkup = state.field(exposeMarkupField, false);
  if (exposeMarkup) return Decoration.none;

  const marks: {from: number, to: number, type: string, widget?: WidgetType}[] = [];
  const selection = state.selection.main;
  const activeLine = state.doc.lineAt(selection.head);

  let frontmatterEndPos = -1;
  if (state.doc.lines > 0 && state.doc.line(1).text.trim() === '---') {
    frontmatterEndPos = state.doc.line(1).to;
    for (let i = 2; i <= state.doc.lines; i++) {
      if (state.doc.line(i).text.trim() === '---') {
        frontmatterEndPos = state.doc.line(i).to;
        break;
      }
    }
  }

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === "Document") return true;
      if (frontmatterEndPos !== -1 && node.to <= frontmatterEndPos) {
        return false;
      }

      const name = node.name;
      
      if (name === "Image") {
        const text = state.doc.sliceString(node.from, node.to);
        const match = text.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) {
          marks.push({from: node.from, to: node.to, type: "replace", widget: new ImageWidget(match[2], match[1], filePath)});
        }
        return false;
      } else if (name === "HorizontalRule") {
        const startLine = state.doc.lineAt(node.from);
        marks.push({from: startLine.from, to: startLine.to, type: "replace-block", widget: new HrWidget()});
        return false;
      } else if (name === "Table") {
        const text = state.doc.sliceString(node.from, node.to);
        const startLine = state.doc.lineAt(node.from);
        const endLine = state.doc.lineAt(node.to);
        marks.push({from: startLine.from, to: endLine.to, type: "replace-block", widget: new TableWidget(text, startLine.from)});
        return false;
      } else if (name === "FencedCode") {
        let pos = node.from;
        while (pos <= node.to) {
          const line = state.doc.lineAt(pos);
          marks.push({from: line.from, to: line.from, type: "line"});
          pos = line.to + 1;
        }
        
        const firstLine = state.doc.lineAt(node.from);
        const match = firstLine.text.match(/^(\s*```+)\s*(.*)$/);
        if (match) {
            const lang = match[2].trim() || 'auto';
            marks.push({
               from: firstLine.to, 
               to: firstLine.to, 
               type: "widget-append", 
               widget: new CodeLanguageWidget(lang, node.from)
            });
        }
      } else if (name === "TaskMarker") {
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
      } else if (name === "ListMark") {
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
          const nextChar = state.doc.sliceString(node.to, node.to + 1);
          if (/^[-*+]\s*$/.test(text) && nextChar === ' ') {
            marks.push({
              from: node.from, 
              to: node.to, 
              type: "replace", 
              widget: new BulletWidget(text.replace(/[-*+]/, "•"))
            });
          }
        }
      }

      let shouldHide = false;
      if (name === "HeaderMark" || name === "QuoteMark") {
        const nextChar = state.doc.sliceString(node.to, node.to + 1);
        if (nextChar === ' ') {
          shouldHide = true;
        }
      } else if (
        name === "EmphasisMark" ||
        name === "CodeMark" ||
        name === "CodeInfo" ||
        name === "LinkMark" ||
        (name === "URL" && node.node.parent?.name === "Link")
      ) {
        shouldHide = true;
      }

      if (shouldHide) {
        // Do not hide the trailing space so the browser native caret has a text node to latch onto
        const hideTo = node.to;
        marks.push({from: node.from, to: hideTo, type: "hide"});
      } else if (name === "Escape") {
        const char = state.doc.sliceString(node.from + 1, node.to);
        marks.push({from: node.from, to: node.to, type: "replace", widget: new EscapeWidget(char)});
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
    } else if (mark.type === "widget-append" && mark.widget) {
      return Decoration.widget({ widget: mark.widget, side: 1 }).range(mark.from);
    } else if (mark.type === "mark-dangling") {
      return danglingLinkDeco.range(mark.from, mark.to);
    }
    return null;
  }).filter((d): d is any => d !== null);

  if (frontmatterEndPos > 0) {
    decorations.push(Decoration.mark({ class: "cm-frontmatter" }).range(0, frontmatterEndPos));
  }

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
    if (tr.docChanged || tr.selection || tr.effects.some(e => e.is(toggleMarkupEffect))) {
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
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--text-selection) !important",
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
    backgroundColor: "transparent",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-link-dangling": {
    color: "var(--text-error, #f87171) !important",
    textDecoration: "underline wavy var(--text-error, #f87171) !important"
  }
});

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

const handleBackspace = (view: EditorView) => {
  const selection = view.state.selection.main;
  const doc = view.state.doc;
  const marks = ["**", "*", "~~", "_", "__", "`"];

  if (!selection.empty) {
    for (const mark of marks) {
      const markLen = mark.length;
      if (selection.from >= markLen && selection.to <= doc.length - markLen) {
        const before = doc.sliceString(selection.from - markLen, selection.from);
        const after = doc.sliceString(selection.to, selection.to + markLen);
        if (before === mark && after === mark) {
          view.dispatch({
            changes: { from: selection.from - markLen, to: selection.to + markLen, insert: "" }
          });
          return true;
        }
      }
    }
    return false;
  }

  for (const mark of marks) {
    const markLen = mark.length;
    // Case 1: Cursor is immediately after a single character inside marks: **a|**
    if (selection.from >= markLen + 1 && selection.from <= doc.length - markLen) {
      const beforeMark = doc.sliceString(selection.from - 1 - markLen, selection.from - 1);
      const afterMark = doc.sliceString(selection.from, selection.from + markLen);
      if (beforeMark === mark && afterMark === mark) {
        view.dispatch({
          changes: { from: selection.from - 1 - markLen, to: selection.from + markLen, insert: "" }
        });
        return true;
      }
    }
    // Case 2: Cursor is between marks: **|** or **\u200B|**
    if (selection.from >= markLen && selection.from <= doc.length - markLen) {
      const beforeMark = doc.sliceString(selection.from - markLen, selection.from);
      const afterMark = doc.sliceString(selection.from, selection.from + markLen);
      if (beforeMark === mark && afterMark === mark) {
        view.dispatch({
          changes: { from: selection.from - markLen, to: selection.from + markLen, insert: "" }
        });
        return true;
      }
    }
  }

  return false;
};

const toggleInlineFormatting = (view: EditorView, mark: string) => {
  const selection = view.state.selection.main;
  const doc = view.state.doc;
  const markLen = mark.length;
  
  if (selection.empty) {
    // If the cursor is exactly before the ending mark, step OVER it to "get out" of the bolding
    if (selection.from <= doc.length - markLen) {
      const after = doc.sliceString(selection.to, selection.to + markLen);
      if (after === mark) {
        view.dispatch({
          selection: { anchor: selection.to + markLen }
        });
        return true;
      }
    }
  }

  if (selection.from >= markLen && selection.to <= doc.length - markLen) {
    const before = doc.sliceString(selection.from - markLen, selection.from);
    const after = doc.sliceString(selection.to, selection.to + markLen);
    
    if (before === mark && after === mark) {
      view.dispatch({
        changes: [
          { from: selection.from - markLen, to: selection.from, insert: "" },
          { from: selection.to, to: selection.to + markLen, insert: "" }
        ],
        selection: { anchor: selection.from - markLen, head: selection.to - markLen }
      });
      return true;
    }
  }
  
  const text = doc.sliceString(selection.from, selection.to);
  const insertText = text === "" ? "\u200B" : text;

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: `${mark}${insertText}${mark}` },
    selection: { anchor: selection.from + markLen, head: selection.from + markLen + insertText.length }
  });
  return true;
};

const toggleBlockFormatting = (view: EditorView, prefix: string) => {
  const selection = view.state.selection.main;
  const line = view.state.doc.lineAt(selection.from);
  
  let newText = line.text.replace(/^(#{1,6}\s+|- \[\s\]\s|- \[[xX]\]\s|[-*+]\s|\d+\.\s|> \s?)/, '');
  
  if (prefix !== '') {
    const currentPrefixMatch = line.text.match(/^(#{1,6}\s+|- \[\s\]\s|- \[[xX]\]\s|[-*+]\s|\d+\.\s|> \s?)/);
    if (!currentPrefixMatch || currentPrefixMatch[0] !== prefix) {
      newText = prefix + newText;
    }
  }

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newText },
    selection: { anchor: Math.max(line.from, selection.from + (newText.length - line.text.length)) }
  });
  return true;
};

export const Editor = React.forwardRef<EditorHandle, EditorProps>(({ initialContent, onSave, fileName, filePath, initialCursorPos, onCursorChange, allFiles, onNavigate, onCreateFile, onRename, children }, ref) => {
  const { settings } = useSettings();
  const [content, setContent] = useState(initialContent);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const dynamicTheme = EditorView.theme({}, { dark: isDark });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [viewMode, setViewMode] = useState<'source' | 'rich' | 'reading'>('rich');
  const [parsedData, setParsedData] = useState<{data: any, content: string}>({ data: {}, content: initialContent });

  useEffect(() => {
    try {
      const parsed = matter(content);
      setParsedData(parsed);
    } catch (e) {
      setParsedData({ data: {}, content });
    }
  }, [content]);

  useEffect(() => {
    if (viewMode === 'reading') {
      setTimeout(() => mermaid.run(), 100);
    }
  }, [content, viewMode]);


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

  const slashCompletionSource = React.useCallback(async (context: CompletionContext): Promise<CompletionResult | null> => {
    let word = context.matchBefore(/\/[a-zA-Z0-9]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;

    const options = [
      { label: "/h1", detail: "Heading 1", type: "keyword", apply: "# " },
      { label: "/h2", detail: "Heading 2", type: "keyword", apply: "## " },
      { label: "/h3", detail: "Heading 3", type: "keyword", apply: "### " },
      { label: "/bullet", detail: "Bulleted List", type: "keyword", apply: "- " },
      { label: "/number", detail: "Numbered List", type: "keyword", apply: "1. " },
      { label: "/todo", detail: "To-do List", type: "keyword", apply: "- [ ] " },
      { label: "/quote", detail: "Blockquote", type: "keyword", apply: "> " },
      { label: "/code", detail: "Code Block", type: "keyword", apply: "```\n\n```" },
      { label: "/table", detail: "Table", type: "keyword", apply: "\n| Column 1 | Column 2 |\n| -------- | -------- |\n| Text     | Text     |\n" },
    ];

    return {
      from: word.from,
      options
    };
  }, []);

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
          <div className="editor-mode-toggles">
            <button className={`toggle-btn ${viewMode === 'source' ? 'active' : ''}`} onClick={() => setViewMode('source')} title="Source Mode">
              <Code size={14} />
            </button>
            <button className={`toggle-btn ${viewMode === 'rich' ? 'active' : ''}`} onClick={() => setViewMode('rich')} title="Rich Edit Mode">
              <Edit2 size={14} />
            </button>
            <button className={`toggle-btn ${viewMode === 'reading' ? 'active' : ''}`} onClick={() => setViewMode('reading')} title="Reading Mode">
              <BookOpen size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className={`editor-content-area mode-${viewMode}`}>
        {(viewMode === 'source' || viewMode === 'rich') && (
          <div className="editor-scroll-area">
            <CodeMirror
              className={`cm-outer-wrapper ${settings.typewriterMode ? 'typewriter-active' : ''}`}
              value={content}
              height="auto"
              extensions={[
                exposeMarkupField,
                markdown({ base: customMarkdownLanguage, codeLanguages: languages, extensions: [GFM] }),
                gladeTheme,
                dynamicTheme,
                syntaxHighlighting(markdownHighlighting),
                checkboxInteraction,
                pasteHandler,
                dropHandler,
                ...(settings.typewriterMode ? [typewriterScroll] : []),
                ...(viewMode === 'rich' ? [
                  livePreviewField, 
                  disableFormattingInputHandler,
                  EditorView.atomicRanges.of(view => view.state.field(livePreviewField))
                ] : []),
                linkHoverTooltip,
                linkClickHandler,
                closeBrackets(),
                drawSelection(),
                history(),
                search({ top: true }),
                autocompletion({ override: [linkCompletionSource, macroCompletionSource, slashCompletionSource] }),
                keymap.of([
                  ...defaultKeymap,
                  ...standardKeymap,
                  ...historyKeymap,
                  ...searchKeymap,
                  { key: "Enter", run: insertNewlineContinueMarkup },
                  { key: "Backspace", run: handleBackspace },
                  { key: "Backspace", run: deleteMarkupBackward },
                  {
                    key: "Mod-b",
                    run: (view) => toggleInlineFormatting(view, "**")
                  },
                  {
                    key: "Mod-i",
                    run: (view) => toggleInlineFormatting(view, "*")
                  },
                  { key: "Mod-Shift-x", run: (view) => toggleInlineFormatting(view, "~~") },
                  { key: "Alt-Shift-5", run: (view) => toggleInlineFormatting(view, "~~") },
                  { key: "Mod-Alt-1", run: (view) => toggleBlockFormatting(view, "# ") },
                  { key: "Mod-Alt-2", run: (view) => toggleBlockFormatting(view, "## ") },
                  { key: "Mod-Alt-3", run: (view) => toggleBlockFormatting(view, "### ") },
                  { key: "Mod-Alt-4", run: (view) => toggleBlockFormatting(view, "#### ") },
                  { key: "Mod-Alt-5", run: (view) => toggleBlockFormatting(view, "##### ") },
                  { key: "Mod-Alt-6", run: (view) => toggleBlockFormatting(view, "###### ") },
                  { key: "Mod-Alt-0", run: (view) => toggleBlockFormatting(view, "") },
                  { key: "Mod-Shift-7", run: (view) => toggleBlockFormatting(view, "1. ") },
                  { key: "Mod-Shift-8", run: (view) => toggleBlockFormatting(view, "- ") },
                  { key: "Mod-Shift-9", run: (view) => toggleBlockFormatting(view, "> ") },
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
                  },
                  {
                    key: "Mod-Alt-m",
                    run: (view) => {
                      view.dispatch({
                        effects: toggleMarkupEffect.of()
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
        )}
        {viewMode === 'reading' && (
          <div className="preview-scroll-area">
            {Object.keys(parsedData.data).length > 0 && (
              <div className="frontmatter-display">
                <pre>{JSON.stringify(parsedData.data, null, 2)}</pre>
              </div>
            )}
            <div 
              className="markdown-preview" 
              onClick={(e) => {
                const target = e.target as HTMLElement;
                const link = target.closest('a');
                if (link) {
                  const href = link.getAttribute('href');
                  const internalHref = link.getAttribute('data-href');
                  
                  if (internalHref && onNavigate) {
                    e.preventDefault();
                    onNavigate(internalHref);
                  } else if (href && !href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('tauri:') && onNavigate) {
                    e.preventDefault();
                    onNavigate(href);
                  } else if (href && href.startsWith('http')) {
                    e.preventDefault();
                    import('@tauri-apps/plugin-opener').then(module => {
                      module.openUrl(href);
                    }).catch(err => {
                      console.error("Failed to load plugin-opener:", err);
                    });
                  }
                }
              }}
              dangerouslySetInnerHTML={{ 
                __html: marked.parse(
                  parsedData.content.replace(/\[\[([^\]]+)\]\]/g, '<a href="#$1" class="internal-link" data-href="$1">$1</a>'), 
                  getMarkedOptions(filePath)
                ) as string 
              }} 
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default Editor;
