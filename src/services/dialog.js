/**
 * dialog.js
 * In-app replacements for window.confirm and window.prompt.
 *
 * The native dialogs are ugly, unstyleable, and block the whole page thread.
 * These keep the same shape a caller expects — `await confirmDialog(...)`
 * resolves to a boolean, `await promptDialog(...)` to a string or null — so a
 * handler reads almost exactly as it did, while <DialogHost> renders proper UI.
 *
 * Requests queue: asking for a second dialog while one is open waits its turn
 * rather than dropping it or stacking modals on top of each other.
 */

let subscriber = null;
const queue = [];

const pump = () => {
  if (!subscriber || subscriber.busy || queue.length === 0) return;
  subscriber.busy = true;
  subscriber.show(queue[0].spec);
};

/** DialogHost registers here. Returns an unsubscribe. */
export function subscribeDialog(show) {
  subscriber = { show, busy: false };
  pump();
  return () => { subscriber = null; };
}

/** DialogHost calls this when the user resolves the current dialog. */
export function resolveDialog(result) {
  const current = queue.shift();
  if (subscriber) subscriber.busy = false;
  current?.resolve(result);
  pump();
}

const request = (spec) => new Promise((resolve) => {
  queue.push({ spec, resolve });
  pump();
});

/**
 * A yes/no dialog. Resolves true if confirmed, false otherwise.
 * @param {{title?, message, confirmLabel?, cancelLabel?, danger?}} opts
 */
export const confirmDialog = (opts) => request({ kind: 'confirm', ...opts });

/**
 * A single-field text dialog. Resolves the entered string, or null if
 * cancelled. An empty or whitespace-only entry resolves null too, so callers
 * never have to re-check for blank input.
 * @param {{title?, message?, label?, defaultValue?, placeholder?, confirmLabel?}} opts
 */
export const promptDialog = (opts) => request({ kind: 'prompt', ...opts });
