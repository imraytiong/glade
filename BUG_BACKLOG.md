# Bug Backlog

This backlog tracks issues and bugs identified during testing, along with root cause analysis and fix proposals for the builder agent to execute.

## 1. File Explorer Drag and Drop Issue

**Status:** 🟢 Fixed

**Description:**
In the file explorer, dragging and dropping files to move them between folders does not work. The drop event is not fired.

**Root Cause:**
In `src/components/FileExplorer.tsx`, the drag source (`.file-node`) sets `e.dataTransfer.effectAllowed = 'copyLink'`. However, the drop target (folders) sets `e.dataTransfer.dropEffect = 'move'` in `handleDragOver`. Because `'move'` is not an allowed operation when `effectAllowed` is `'copyLink'`, the browser natively rejects the drop.

**Proposed Fix for Builder Agent:**
Update the `effectAllowed` property in the `onDragStart` handler of the file nodes to allow moving.
```tsx
// In src/components/FileExplorer.tsx
- e.dataTransfer.effectAllowed = 'copyLink';
+ e.dataTransfer.effectAllowed = 'move';
```

## 2. Missing Internal Knowledge Fallback Toggle in Agent Configuration

**Status:** 🟢 Fixed

**Description:**
In the agent configuration UI (`AgentWorkspace.tsx`), users have lost the ability to enable or disable the agent from using its own training data (internal understanding). The backend properly supports the `allow_internal_knowledge_fallback` field, but it is absent from the frontend form.

**Root Cause:**
The `allow_internal_knowledge_fallback` property is missing from the `Agent` interface defined in `src/components/agent/AgentWorkspace.tsx` and `src/types/agent.ts`. Consequently, there is no UI toggle to control this setting, and the `isChanged` dirty-state logic doesn't track it.

**Proposed Fix for Builder Agent:**
1. **Update the `Agent` interface:** Add `allow_internal_knowledge_fallback?: boolean;` to the `Agent` interface in `src/components/agent/AgentWorkspace.tsx` and `src/types/agent.ts`.
2. **Add a UI Toggle:** Add a checkbox or toggle in the Configuration Form (e.g., near the "Memory (Context Bank)" section in `AgentWorkspace.tsx`) to control `formData.allow_internal_knowledge_fallback`. For new agents, default it to true.
3. **Update Dirty State Logic:** Include `agent.allow_internal_knowledge_fallback !== formData.allow_internal_knowledge_fallback` in the `isChanged` check around line 77 of `AgentWorkspace.tsx`.

## 3. Transparent Alert Window Background

**Status:** 🟢 Fixed

**Description:**
Whenever an issue creates an alert window (Error Modal), it is very hard to read because the background of the modal is transparent, causing the text to bleed into the underlying application content.

**Root Cause:**
In `src/components/ErrorModal.css`, the CSS variables used for coloring do not match the application's design system. For example, `.error-modal-content` uses `var(--bg-primary)`, which is undefined, resulting in a transparent background. Other text and border colors are also using the wrong variable namespace (e.g., `--text-primary` instead of `--text-normal`).

**Proposed Fix for Builder Agent:**
Update the CSS variables in `src/components/ErrorModal.css` to align with the global CSS variables used in the rest of the application.

#### [MODIFY] `src/components/ErrorModal.css`
```css
/* Update .error-modal-content */
- background-color: var(--bg-primary);
+ background-color: var(--background-primary);
- border: 1px solid var(--border-color, #333);
+ border: 1px solid var(--background-modifier-border, #333);

/* Update .error-modal-message */
- color: var(--text-primary);
+ color: var(--text-normal);

/* Update .error-modal-details-btn */
- color: var(--text-accent);
+ color: var(--interactive-accent);

/* Update .error-modal-details-content */
- background-color: var(--bg-secondary);
+ background-color: var(--background-secondary);
- border: 1px solid var(--border-color, #333);
+ border: 1px solid var(--background-modifier-border, #333);
```
