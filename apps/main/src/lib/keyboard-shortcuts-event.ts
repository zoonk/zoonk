const OPEN_KEYBOARD_SHORTCUTS_EVENT = "zoonk:open-keyboard-shortcuts";

export function openKeyboardShortcuts() {
  globalThis.dispatchEvent(new Event(OPEN_KEYBOARD_SHORTCUTS_EVENT));
}

export function listenForKeyboardShortcuts(open: () => void): () => void {
  globalThis.addEventListener(OPEN_KEYBOARD_SHORTCUTS_EVENT, open);
  return () => globalThis.removeEventListener(OPEN_KEYBOARD_SHORTCUTS_EVENT, open);
}
