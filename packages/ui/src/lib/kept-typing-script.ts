export const KEEP_TYPING_ATTRIBUTE = "data-keep-typing";

/**
 * On the box that draws a select's value for it, keyed like the select: each child shows the option
 * whose value is its `data-value`, and the one picked before the page hydrates shows at once.
 */
export const KEPT_READOUT_ATTRIBUTE = "data-kept-readout";

/** What a radio that opted in keeps: it was picked. */
export const KEPT_PICK = "picked";

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
function keepTypingBeforeReady({
  field: attribute,
  pick,
  readout,
}: {
  field: string;
  pick: string;
  readout: string;
}) {
  const kept: KeptTyping = { taken: new Set(), typed: new Map() };
  globalThis.zoonkKeptTyping = kept;

  const showPicked = (key: string, value: string) => {
    for (const box of document.querySelectorAll(`[${readout}]`)) {
      if (box.getAttribute(readout) === key) {
        for (const shown of box.children) {
          if (shown instanceof HTMLElement) {
            shown.hidden = shown.dataset.value !== value;
          }
        }
      }
    }
  };

  document.addEventListener(
    "input",
    (event) => {
      const field = event.target;
      const isRadio = field instanceof HTMLInputElement && field.type === "radio";

      const keeps =
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement ||
        (field instanceof HTMLInputElement && !["checkbox", "file"].includes(field.type));

      if (!keeps) {
        return;
      }

      const key = field.getAttribute(attribute);

      if (!key || kept.taken.has(key)) {
        return;
      }

      kept.typed.set(key, isRadio ? pick : field.value);

      if (field instanceof HTMLSelectElement) {
        showPicked(key, field.value);
      }
    },
    { capture: true, passive: true },
  );
}

export const KEEP_TYPING_SCRIPT = `(${keepTypingBeforeReady.toString()})(${JSON.stringify({ field: KEEP_TYPING_ATTRIBUTE, pick: KEPT_PICK, readout: KEPT_READOUT_ATTRIBUTE })})`;
