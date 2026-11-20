export const KEEP_TYPING_ATTRIBUTE = "data-keep-typing";

type KeptTyping = { taken: Set<string>; typed: Map<string, string> };

declare global {
  var zoonkKeptTyping: KeptTyping | undefined;
}

/**
 * Runs inline in the page's `<head>` so words typed and options picked before hydration survive it. React replays them
 * since https://github.com/facebook/react/pull/33129, but only with `enableHydrationChangeEvent`,
 * which the canary build Next runs leaves off. Serialized with `toString`, so it may use only its
 * argument and globals.
 */
function keepTypingBeforeReady(attribute: string) {
  const kept: KeptTyping = { taken: new Set(), typed: new Map() };
  globalThis.zoonkKeptTyping = kept;

  document.addEventListener(
    "input",
    (event) => {
      const field = event.target;

      const keeps =
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement ||
        (field instanceof HTMLInputElement && !["checkbox", "file", "radio"].includes(field.type));

      if (!keeps) {
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

export const KEEP_TYPING_SCRIPT = `(${keepTypingBeforeReady.toString()})(${JSON.stringify(KEEP_TYPING_ATTRIBUTE)})`;
