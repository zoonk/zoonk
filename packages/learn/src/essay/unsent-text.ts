/**
 * The essay being written, kept on the device as it's typed until it's graded: closing the tab or
 * the screen never loses it, and opening the essay again brings it back. Without storage the
 * screen still works; the text just lives as long as the screen.
 */

function getUnsentKey(blockId: string): string {
  return `essay:${blockId}`;
}

export function readUnsentText(blockId: string): string | null {
  try {
    return globalThis.localStorage.getItem(getUnsentKey(blockId));
  } catch {
    return null;
  }
}

export function keepUnsentText({ blockId, text }: { blockId: string; text: string }) {
  try {
    globalThis.localStorage.setItem(getUnsentKey(blockId), text);
  } catch {
    // Without storage the text stays on screen only.
  }
}

export function clearUnsentText(blockId: string) {
  try {
    globalThis.localStorage.removeItem(getUnsentKey(blockId));
  } catch {
    // Nothing to clear without storage.
  }
}
