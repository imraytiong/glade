import { markdownLanguage } from '@codemirror/lang-markdown';

const doc = `
# hello
---
* [x] done
* [ ] not done
- bullet

| a | b |
|---|---|
| 1 | 2 |
`;

const tree = markdownLanguage.parser.parse(doc);
let cursor = tree.cursor();
do {
  console.log(cursor.name, doc.slice(cursor.from, cursor.to));
} while (cursor.next());
