import {EditorState} from "@codemirror/state"
import {markdown, markdownLanguage} from "@codemirror/lang-markdown"
import {syntaxTree} from "@codemirror/language"
import {RangeSetBuilder} from "@codemirror/state"
import {Decoration, WidgetType} from "@codemirror/view"

class DummyWidget extends WidgetType {
  toDOM() { return document.createElement("span"); }
}

const state = EditorState.create({
  doc: "Hello\n- [ ] Task 1\n- Item 1\n---\n",
  extensions: [markdown({base: markdownLanguage})]
})

const marks = [];
const selection = state.selection.main;
const activeLine = state.doc.lineAt(selection.head);

syntaxTree(state).iterate({
  enter: (node) => {
    const isActiveLine = false; // Mock
    const name = node.name;
    const text = state.doc.sliceString(node.from, node.to);
    
    if (name === "TaskMarker") {
      const line = state.doc.lineAt(node.from);
      let listMarkFrom = -1;
      syntaxTree(state).iterate({
        from: line.from, to: node.from,
        enter: (n) => { if (n.name === "ListMark") listMarkFrom = n.from; }
      });
      if (listMarkFrom !== -1) {
        marks.push({from: listMarkFrom, to: node.to, type: "replace", widget: new DummyWidget()});
      }
    } else if (name === "ListMark") {
      const line = state.doc.lineAt(node.from);
      let hasTask = false;
      syntaxTree(state).iterate({
        from: node.to, to: line.to,
        enter: (n) => { if (n.name === "TaskMarker") hasTask = true; }
      });
      if (!hasTask) {
        if (/^[-*+]\s*$/.test(text)) {
          marks.push({from: node.from, to: node.to, type: "replace", widget: new DummyWidget()});
        }
      }
    } else if (name === "HorizontalRule") {
      const startLine = state.doc.lineAt(node.from);
      const endLine = state.doc.lineAt(node.to);
      marks.push({from: startLine.from, to: endLine.to, type: "blockReplace", widget: new DummyWidget()});
    } else if (name === "HeaderMark") {
      marks.push({from: node.from, to: node.to, type: "hide"});
    }
  }
});

marks.sort((a, b) => {
  if (a.from !== b.from) return a.from - b.from;
  if (a.type === "line" && b.type !== "line") return -1;
  if (a.type !== "line" && b.type === "line") return 1;
  return a.to - b.to;
});

const builder = new RangeSetBuilder();
let lastTo = -1;
for (const mark of marks) {
  if (mark.type === "line") {
    builder.add(mark.from, mark.from, Decoration.line({}));
  } else if (mark.from >= lastTo) {
    if (mark.type === "hide") {
      builder.add(mark.from, mark.to, Decoration.replace({}));
    } else if (mark.type === "replace" && mark.widget) {
      builder.add(mark.from, mark.to, Decoration.replace({ widget: mark.widget }));
    } else if (mark.type === "blockReplace" && mark.widget) {
      builder.add(mark.from, mark.to, Decoration.replace({ widget: mark.widget, block: true }));
    }
    lastTo = mark.to;
  }
}

const finish = builder.finish();
console.log("Decorations size:", finish.size);
