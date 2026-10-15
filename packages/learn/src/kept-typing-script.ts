/** The attribute a field opts in with; its value is the field's key on the page. */
export const KEEP_TYPING_ATTRIBUTE = "data-keep-typing";

/** What the keeper holds: the words typed into each field before its code took them, by key. */
type KeptTyping = { taken: Set<string>; typed: Map<string, string> };

declare global {
  /** On `globalThis`, so a field's code finds what the page's inline keeper recorded for it. */
  var zoonkKeptTyping: KeptTyping | undefined;
}

/**
 * The keeper, run inline in the page's `<head>` before any field paints: on a slow device a field
 * shows (with the words a link put in it, say) before its code arrives, and React's hydration
 * puts the field back to those words or keeps a state that never saw the typing. It records, per
 * key, the last words typed into a field carrying `attribute`, until the field's code takes them
 * (`useKeptTyping`). Serialized with `toString`, so it uses only its argument and globals.
 */
function keepTypingBeforeReady(attribute: string) {
  const kept: KeptTyping = { taken: new Set(), typed: new Map() };
  globalThis.zoonkKeptTyping = kept;

  document.addEventListener(
    "input",
    (event) => {
      const field = event.target;

      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
        return;
      }

      const key = field.getAttribute(attribute);

      if (key && !kept.taken.has(key)) {
        kept.typed.set(key, field.value);
      }
    },
    { capture: true, passive: true },
  );
}

/** The keeper as the inline script the page's `<head>` runs. */
export const KEEP_TYPING_SCRIPT = `(${keepTypingBeforeReady.toString()})(${JSON.stringify(KEEP_TYPING_ATTRIBUTE)})`;
