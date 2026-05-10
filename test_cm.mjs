import { RangeSetBuilder } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const builder = new RangeSetBuilder();
builder.add(10, 20, Decoration.replace({}));
try {
  builder.add(15, 15, Decoration.line({}));
  console.log("Success!");
} catch (e) {
  console.error("Error:", e.message);
}
