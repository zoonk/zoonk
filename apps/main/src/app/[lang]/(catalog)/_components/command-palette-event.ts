/**
 * Opens the frame's command palette from elsewhere on the page, such as the account menu's
 * "Search". The palette and the menu render apart, so a window event joins them without a shared
 * provider.
 */
const OPEN_COMMAND_PALETTE_EVENT = "zoonk:open-command-palette";

export function openCommandPalette() {
  globalThis.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}

/** Lets the mounted palette answer `openCommandPalette`. Returns the cleanup. */
export function listenForCommandPaletteOpen(open: () => void): () => void {
  globalThis.addEventListener(OPEN_COMMAND_PALETTE_EVENT, open);
  return () => globalThis.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, open);
}
