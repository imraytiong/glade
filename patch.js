const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf-8');

const replacement = `
class ImageWidget extends WidgetType {
  constructor(readonly url: string, readonly alt: string) { super(); }
  eq(other: ImageWidget) { return other.url === this.url && other.alt === this.alt; }
  toDOM() {
    const wrap = document.createElement("span");
    const img = document.createElement("img");
    img.src = this.url;
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
    const wrap = document.createElement("div");
    const hr = document.createElement("hr");
    hr.className = "cm-hr";
    hr.style.border = "none";
    hr.style.borderTop = "2px solid var(--background-modifier-border)";
    hr.style.margin = "24px 0";
    wrap.appendChild(hr);
    return wrap;
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
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    
    const lines = this.text.trim().split('\\n');
    let html = '';
    lines.forEach((line, i) => {
      if (i === 1 && line.match(/^[-|: ]+$/)) return;
      const isHeader = i === 0;
      const tag = isHeader ? 'th' : 'td';
      const cells = line.replace(/^\\||\\|$/g, '').split('|');
      const rowHtml = cells.map(c => {
        const style = \`border: 1px solid var(--background-modifier-border); padding: 8px 12px; \${isHeader ? 'background: var(--background-secondary); font-weight: bold;' : ''}\`;
        return \`<\\${tag} style="\${style}">\${c.trim()}</\\${tag}>\`;
      }).join('');
      html += \`<tr>\${rowHtml}</tr>\`;
    });
    table.innerHTML = html;
    wrap.appendChild(table);
    return wrap;
  }
}

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
    const marks: {from: number, to: number, type: string, widget?: WidgetType}[] = [];
    const selection = view.state.selection.main;
    const activeLine = view.state.doc.lineAt(selection.head);

    for (let { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node) => {
          const isActiveLine = node.from >= activeLine.from && node.from <= activeLine.to;
          
          const name = node.name;
          if (name === "Image") {
            if (!isActiveLine) {
              const text = view.state.doc.sliceString(node.from, node.to);
              const match = text.match(/!\\[(.*?)\\]\\((.*?)\\)/);
              if (match) {
                marks.push({from: node.from, to: node.to, type: "replace", widget: new ImageWidget(match[2], match[1])});
              }
            }
            return false;
          } else if (name === "HorizontalRule") {
            if (!isActiveLine) {
              marks.push({from: node.from, to: node.to, type: "replace", widget: new HrWidget()});
            }
            return false;
          } else if (name === "Table") {
            if (!isActiveLine) {
              const text = view.state.doc.sliceString(node.from, node.to);
              marks.push({from: node.from, to: node.to, type: "replace", widget: new TableWidget(text)});
            }
            return false;
          } else if (name === "FencedCode") {
             // We could replace fenced code blocks entirely, but editing them is nicer as text.
             // We will handle styling code blocks with CSS
             // Let's just hide CodeMark if not active line
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
    }

    marks.sort((a, b) => a.from - b.from || a.to - b.to);
    
    const builder = new RangeSetBuilder<Decoration>();
    let lastTo = -1;
    for (const mark of marks) {
      if (mark.from >= lastTo) {
        if (mark.type === "hide") {
          builder.add(mark.from, mark.to, hideMarkDeco);
        } else if (mark.type === "replace" && mark.widget) {
          builder.add(mark.from, mark.to, Decoration.replace({ widget: mark.widget }));
        }
        lastTo = mark.to;
      }
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations
});
`;

// Replace the existing livePreviewPlugin definition (including hideMarkDeco)
// First let's remove everything from const hideMarkDeco to the end of livePreviewPlugin definition
const startIndex = code.indexOf('const hideMarkDeco = Decoration.replace({});');
const endIndex = code.indexOf('const gladeTheme = EditorView.theme({');

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + replacement + '\n' + code.substring(endIndex);
  fs.writeFileSync('src/components/Editor.tsx', code);
  console.log('Successfully patched livePreviewPlugin!');
} else {
  console.log('Could not find markers to patch');
}
