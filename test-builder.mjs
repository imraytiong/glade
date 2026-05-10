import {EditorState} from "@codemirror/state"
import {markdown, markdownLanguage} from "@codemirror/lang-markdown"
import {syntaxTree} from "@codemirror/language"

const state = EditorState.create({
  doc: "Hello\n- [ ] Task 1\n- Item 1\n---\n",
  extensions: [markdown({base: markdownLanguage})]
})

const marks = [];
syntaxTree(state).iterate({
  enter: (node) => {
    const name = node.name;
    const text = state.doc.sliceString(node.from, node.to);
    console.log(name, node.from, node.to, JSON.stringify(text));
    
    if (name === "TaskMarker") {
      const line = state.doc.lineAt(node.from);
      let listMarkFrom = -1;
      syntaxTree(state).iterate({
        from: line.from, to: node.from,
        enter: (n) => { if (n.name === "ListMark") listMarkFrom = n.from; }
      });
      if (listMarkFrom !== -1) {
        marks.push({from: listMarkFrom, to: node.to, type: "replace"});
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
          marks.push({from: node.from, to: node.to, type: "bullet"});
        }
      }
    } else if (name === "HorizontalRule") {
      const startLine = state.doc.lineAt(node.from);
      const endLine = state.doc.lineAt(node.to);
      marks.push({from: startLine.from, to: endLine.to, type: "hr"});
    }
  }
});

console.log("Marks:", marks);
