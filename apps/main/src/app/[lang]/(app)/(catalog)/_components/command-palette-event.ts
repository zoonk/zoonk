/** The palette and the account menu render apart, so a window event joins them without a shared provider. */
const OPEN_COMMAND_PALETTE_EVENT = "zoonk:open-command-palette";

/** The palette streams in after the page, so an early "Search" waits for it; a later palette never opens on its own. */
const PENDING_OPEN_MS = 10_000;

let pendingOpenAt: number | null = null;

export function openCommandPalette() {
  // A listening palette cancels the event to say it opened.
  const unanswered = globalThis.dispatchEvent(
    new Event(OPEN_COMMAND_PALETTE_EVENT, { cancelable: true }),
  );

  pendingOpenAt = unanswered ? Date.now() : null;
}

export function dropPendingCommandPalette() {
  pendingOpenAt = null;
}

export function listenForCommandPaletteOpen(open: () => void): () => void {
  function answer(event: Event) {
    event.preventDefault();
    open();
  }

  globalThis.addEventListener(OPEN_COMMAND_PALETTE_EVENT, answer);

  if (pendingOpenAt !== null && Date.now() - pendingOpenAt < PENDING_OPEN_MS) {
    open();
  }

  pendingOpenAt = null;

  return () => globalThis.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, answer);
}

/** It never answers, so the request waits for the palette it loads. */
export function listenForCommandPaletteRequest(request: () => void): () => void {
  globalThis.addEventListener(OPEN_COMMAND_PALETTE_EVENT, request);
  return () => globalThis.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, request);
}
