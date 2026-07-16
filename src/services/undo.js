/**
 * undo.js
 * A small undo stack for destructive edits to the open project.
 *
 * Rather than model every action as a reversible command, undo works by
 * snapshot: capture the whole project just before a destructive change, and to
 * undo, write the snapshot back. Simple, and it cannot get an action's inverse
 * wrong — the previous state IS the inverse.
 *
 * Undo lives only as long as the tab. Reaching further back — after a reload,
 * or into an earlier session — is what version history on the .tw file is for.
 * The two are deliberately separate: this is the fast "oops" for the last few
 * actions, history is the durable record.
 *
 * PDFs are not snapshotted — they are large and immutable. This works only
 * because callers no longer delete a PDF's bytes when its item is removed; the
 * blob stays cached, so undoing a delete finds it again, and the save path
 * prunes genuinely unreferenced PDFs out of the file regardless.
 */

import { getProject, replaceProject } from './projectStore';

const MAX_DEPTH = 30;

let stack = []; // [{ label, snapshot }]  newest last
const listeners = new Set();

const emit = () => {
  const top = stack[stack.length - 1] || null;
  listeners.forEach((l) => l(top ? top.label : null, stack.length));
};

/** Subscribe to changes: (topLabel | null, depth) => void. Fires immediately. */
export function onUndoChange(listener) {
  listeners.add(listener);
  listener(stack.length ? stack[stack.length - 1].label : null, stack.length);
  return () => listeners.delete(listener);
}

export const canUndo = () => stack.length > 0;
export const undoLabel = () => (stack.length ? stack[stack.length - 1].label : null);

/**
 * Record the project as it stands, labelled with what is about to happen.
 * Call this immediately BEFORE the destructive change, never after.
 */
export function recordUndo(label) {
  stack.push({ label, snapshot: JSON.stringify(getProject()) });
  if (stack.length > MAX_DEPTH) stack.shift();
  emit();
}

/**
 * Undo the most recent recorded change by writing its snapshot back.
 * Returns the label undone, or null if there was nothing to undo.
 *
 * replaceProject fires the store's change listeners, so the session saves the
 * reverted project to the .tw exactly as it would any other edit.
 */
export function undo() {
  const entry = stack.pop();
  emit();
  if (!entry) return null;
  replaceProject(JSON.parse(entry.snapshot));
  return entry.label;
}

/** Drop the stack — on closing or switching projects, where it is meaningless. */
export function clearUndo() {
  stack = [];
  emit();
}
