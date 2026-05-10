import {parser} from "@lezer/markdown"
const tree = parser.parse("`code` ~~strike~~");
let cursor = tree.cursor();
do {
  console.log(cursor.name);
} while (cursor.next());
