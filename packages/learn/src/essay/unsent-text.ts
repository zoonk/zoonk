import { deviceStorage } from "../_utils/device-storage";

/**
 * The essay being written, kept on the device as it's typed until it's graded: closing the tab or
 * the screen never loses it, and opening the essay again brings it back. Without storage the
 * screen still works; the text just lives as long as the screen.
 */

function getUnsentKey(blockId: string): string {
  return `essay:${blockId}`;
}

export function readUnsentText(blockId: string): string | null {
  return deviceStorage.get(getUnsentKey(blockId));
}

export function keepUnsentText({ blockId, text }: { blockId: string; text: string }) {
  deviceStorage.set(getUnsentKey(blockId), text);
}

export function clearUnsentText(blockId: string) {
  deviceStorage.remove(getUnsentKey(blockId));
}
