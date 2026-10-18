/**
 * Opens the frame's command palette from elsewhere on the page, such as the account menu's
 * "Search". The palette and the menu render apart, so a window event joins them without a shared
 * provider.
 */
const OPEN_COMMAND_PALETTE_EVENT = "zoonk:open-command-palette";

/**
 * How long a request waits for a palette: the palette streams in after the page, so "Search"
 * chosen in its first moments would otherwise do nothing. A later palette never opens on its own.
 */
const PENDING_OPEN_MS = 10_000;

/** When a request no palette answered was made; null once one did, or the learner moved on. */
let pendingOpenAt: number | null = null;

export function openCommandPalette() {
  // A listening palette cancels the event to say it opened.
  const unanswered = globalThis.dispatchEvent(
    new Event(OPEN_COMMAND_PALETTE_EVENT, { cancelable: true }),
  );

  pendingOpenAt = unanswered ? Date.now() : null;
}

/**
 * Forgets a request no palette answered: the learner moved to another page, so they chose
 * something else (`PaletteRequestReset` calls it on every navigation).
 */
export function dropPendingCommandPalette() {
  pendingOpenAt = null;
}

/**
 * Lets the mounted palette answer `openCommandPalette`, opening at once for a request made just
 * before it arrived on this same page. Returns the cleanup.
 */
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

/**
 * Lets the palette's launcher hear every request before a palette answers one, so it loads the
 * palette (which then opens for the request it missed). It never answers, so the request waits.
 * Returns the cleanup.
 */
export function listenForCommandPaletteRequest(request: () => void): () => void {
  globalThis.addEventListener(OPEN_COMMAND_PALETTE_EVENT, request);
  return () => globalThis.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, request);
}
