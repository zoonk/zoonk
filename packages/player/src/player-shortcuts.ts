export const PLAYER_AUDIO_KEYBOARD_SHORTCUT = "p";

export const MAX_NUMBER_KEY_SHORTCUT = 9;

/**
 * Player number shortcuts use the keys learners can press directly. Lists can
 * contain more than 9 options, but double-digit shortcuts are not supported by
 * the key handler and should not be shown in the UI.
 */
export function getNumberKeyShortcut(index: number): string | null {
  if (index >= MAX_NUMBER_KEY_SHORTCUT) {
    return null;
  }

  return String(index + 1);
}
