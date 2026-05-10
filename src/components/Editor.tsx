import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import './Editor.css';

import { convertFileSrc } from '@tauri-apps/api/core';

interface EditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
  filePath: string;
}

import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { Decoration, DecorationSet, WidgetType } from "@codemirror/view";

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
      const resolvedPath = isAbsolute ? this.url : `${dir}/${this.url}`;
      
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
const bulletMarkDeco = Decoration.mark({ class: "cm-list-bullet" });

import { EditorState, StateField } from '@codemirror/state';

const buildDeco = (state: EditorState, filePath: string) => {
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
              marks.push({from: node.from, to: node.to, type: "mark-bullet"});
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
        name === "URL"
      ) {
        marks.push({from: node.from, to: node.to, type: "hide"});
      }
    }
  });

  marks.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    const isLineA = a.type.startsWith("line");
    const isLineB = b.type.startsWith("line");
    if (isLineA && !isLineB) return -1;
    if (!isLineA && isLineB) return 1;
    return a.to - b.to;
  });
  
  const builder = new RangeSetBuilder<Decoration>();
  let lastTo = -1;
  for (const mark of marks) {
    if (mark.type === "line") {
      builder.add(mark.from, mark.from, codeBlockLineDeco);
    } else if (mark.from >= lastTo) {
      if (mark.type === "hide") {
        builder.add(mark.from, mark.to, hideMarkDeco);
      } else if (mark.type === "mark-bullet") {
        builder.add(mark.from, mark.to, bulletMarkDeco);
      } else if (mark.type === "replace" && mark.widget) {
        builder.add(mark.from, mark.to, Decoration.replace({ widget: mark.widget }));
      } else if (mark.type === "replace-block" && mark.widget) {
        builder.add(mark.from, mark.to, Decoration.replace({ widget: mark.widget, block: true }));
      }
      lastTo = mark.to;
    }
  }
  return builder.finish();
};

const getLivePreviewField = (filePath: string) => StateField.define<DecorationSet>({
  create(state) {
    return buildDeco(state, filePath);
  },
  update(deco, tr) {
    if (tr.docChanged || tr.selection) {
      return buildDeco(tr.state, filePath);
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
  { tag: t.url, color: "var(--text-muted)" },
  { tag: t.quote, borderLeft: "3px solid var(--interactive-accent)", paddingLeft: "12px", color: "var(--text-muted)", fontStyle: "italic" },
  { tag: t.monospace, fontFamily: "var(--font-monospace)", backgroundColor: "var(--background-modifier-hover)", padding: "2px 4px", borderRadius: "4px", fontSize: "0.9em" },
  { tag: t.comment, color: "var(--text-faint)", fontStyle: "italic" },
  { tag: t.list, color: "var(--text-normal)" },
]);


export const Editor: React.FC<EditorProps> = ({ initialContent, onSave, fileName, filePath }) => {
  const [content, setContent] = useState(initialContent);

  const livePreviewField = React.useMemo(() => getLivePreviewField(filePath), [filePath]);

  // When initialContent changes (e.g., file switched), update local state
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleChange = (val: string) => {
    setContent(val);
    // Debounce save in a real app, but for MVP we can save on blur or with a short timeout.
    // For now, let's just trigger save on change (might be expensive)
    onSave(val); 
  };

  return (
    <div className="editor-wrapper">
      <div className="editor-header">
        <div className="editor-header-inner">
          <span className="file-name">{fileName}</span>
        </div>
      </div>
      <div className="editor-scroll-area">
        <CodeMirror
          className="cm-outer-wrapper"
          value={content}
          height="100%"
          extensions={[
            markdown({ base: markdownLanguage, codeLanguages: languages }),
            gladeTheme,
            syntaxHighlighting(markdownHighlighting),
            checkboxInteraction,
            livePreviewField,
            EditorView.lineWrapping
          ]}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
          }}
        />
      </div>
    </div>
  );
};

export default Editor;
