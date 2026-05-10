import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import './Editor.css';

interface EditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  fileName: string;
}

import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { Decoration, DecorationSet, MatchDecorator, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";

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

const checkboxMatcher = new MatchDecorator({
  regexp: /- \[(x| |X)\]/g,
  decoration: match => Decoration.replace({
    widget: new CheckboxWidget(match[1].toLowerCase() === "x")
  })
});

const checkboxInteraction = EditorView.domEventHandlers({
  change(event, view) {
    const target = event.target as HTMLElement;
    if (target.classList.contains("cm-todo-checkbox")) {
      const isChecked = (target as HTMLInputElement).checked;
      const pos = view.posAtDOM(target);
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos);
        const regex = /- \[(x| |X)\]/g;
        let match;
        while ((match = regex.exec(line.text)) !== null) {
          const matchStart = line.from + match.index;
          const matchEnd = matchStart + 5;
          if (pos >= matchStart && pos <= matchEnd) {
            const replaceFrom = matchStart + 3;
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
  }
});

const checkboxes = ViewPlugin.fromClass(class {
  checkboxes: DecorationSet;
  constructor(view: EditorView) {
    this.checkboxes = checkboxMatcher.createDeco(view);
  }
  update(update: ViewUpdate) {
    this.checkboxes = checkboxMatcher.updateDeco(update, this.checkboxes);
  }
}, {
  decorations: instance => instance.checkboxes,
  provide: plugin => EditorView.atomicRanges.of(view => {
    return view.plugin(plugin)?.checkboxes || Decoration.none;
  })
});

const hideMarkDeco = Decoration.replace({});

const livePreviewPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDeco(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDeco(update.view);
    }
  }

  buildDeco(view: EditorView) {
    const marks: {from: number, to: number}[] = [];
    const selection = view.state.selection.main;
    const activeLine = view.state.doc.lineAt(selection.head);

    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node) => {
          const isActiveLine = node.from >= activeLine.from && node.from <= activeLine.to;
          if (isActiveLine) return;

          const name = node.name;
          if (
            name === "HeaderMark" ||
            name === "EmphasisMark" ||
            name === "CodeMark" ||
            name === "QuoteMark"
          ) {
            marks.push({from: node.from, to: node.to});
          }
        }
      });
    }

    marks.sort((a, b) => a.from - b.from || a.to - b.to);
    
    const builder = new RangeSetBuilder<Decoration>();
    let lastTo = -1;
    for (const {from, to} of marks) {
      if (from >= lastTo) {
        builder.add(from, to, hideMarkDeco);
        lastTo = to;
      }
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations
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
}, { dark: true });

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


const Editor: React.FC<EditorProps> = ({ initialContent, onSave, fileName }) => {
  const [content, setContent] = useState(initialContent);

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
        <span className="file-name">{fileName}</span>
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
            checkboxes,
            checkboxInteraction,
            livePreviewPlugin,
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
