import { deviceStorage } from "../_utils/device-storage";

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
