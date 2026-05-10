import { markdownLanguage } from "@codemirror/lang-markdown";

const text = "- [ ] Task 1\n- Item 1\n1. Numbered\n---";
const tree = markdownLanguage.parser.parse(text);

tree.iterate({
  enter: (node) => {
    console.log(`${node.name} from ${node.from} to ${node.to}: "${text.slice(node.from, node.to)}"`);
  }
});
