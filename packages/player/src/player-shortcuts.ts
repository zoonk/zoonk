export const PLAYER_AUDIO_KEYBOARD_SHORTCUT = "p";

export const MAX_NUMBER_KEY_SHORTCUT = 9;

export function getNumberKeyShortcut(index: number): string | null {
  if (index >= MAX_NUMBER_KEY_SHORTCUT) {
    return null;
  }

  return String(index + 1);
}
