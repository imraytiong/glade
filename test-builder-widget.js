import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';

class HrWidget extends WidgetType {
  toDOM() { return document.createElement('hr'); }
}

try {
  const b = new RangeSetBuilder();
  b.add(0, 0, Decoration.widget({ widget: new HrWidget(), block: true }));
  b.add(0, 5, Decoration.replace({}));
  b.finish();
  console.log("No crash!");
} catch (e) {
  console.log("Crash:", e.message);
}
