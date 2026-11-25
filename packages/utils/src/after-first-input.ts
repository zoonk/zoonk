// `click` too: VoiceOver on older Safari activates a control with only a click.
const INPUT_EVENTS = [
  "click",
  "keydown",
  "pointerdown",
  "pointermove",
  "touchstart",
  "wheel",
] as const;

let firstInput: Promise<void> | null = null;
let hadInput = false;

/**
 * Resolves on the first key, tap, click, pointer move or wheel turn the browser reports as the person's
 * own (`isTrusted`), so automated visits that load a page and leave are never counted.
 */
export function afterFirstInput(): Promise<void> {
  firstInput ??= new Promise((resolve) => {
    const controller = new AbortController();

    const onInput = (event: Event) => {
      if (!event.isTrusted) {
        return;
      }

      hadInput = true;
      controller.abort();
      resolve();
    };

    for (const type of INPUT_EVENTS) {
      globalThis.addEventListener(type, onInput, {
        capture: true,
        passive: true,
        signal: controller.signal,
      });
    }
  });

  return firstInput;
}

export function hadFirstInput(): boolean {
  return hadInput;
}
