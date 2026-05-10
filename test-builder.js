import { RangeSetBuilder } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

try {
  const b = new RangeSetBuilder();
  b.add(0, 5, Decoration.replace({}));
  b.add(2, 4, Decoration.replace({}));
  b.finish();
  console.log("No crash!");
} catch (e) {
  console.log("Crash:", e.message);
}
