const SHORTCUT_HINT_STORAGE_KEY_PREFIX = "zoonk-player-shortcut-hint:v1";

export type PlayerShortcutHint =
  | "checkAnswer"
  | "multipleChoiceNumber"
  | "navigateNext"
  | "navigatePrevious"
  | "promptAudio";

type ShortcutHintStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Keeps every shortcut family on its own durable key so one corrupt or stale
 * value cannot suppress the other player tips.
 */
function getShortcutHintStorageKey(hint: PlayerShortcutHint) {
  return `${SHORTCUT_HINT_STORAGE_KEY_PREFIX}:${hint}`;
}

/**
 * Atomically reserves a shortcut tip for the learner's current local day.
 * Writing before the caller renders the message prevents rapid duplicate
 * clicks, while a storage failure disables the tip instead of repeatedly
 * interrupting learners whose browser blocks localStorage.
 */
export function claimPlayerShortcutHint({
  hint,
  localDate,
  storage,
}: {
  hint: PlayerShortcutHint;
  localDate: string;
  storage: ShortcutHintStorage;
}) {
  const storageKey = getShortcutHintStorageKey(hint);

  try {
    if (storage.getItem(storageKey) === localDate) {
      return false;
    }

    storage.setItem(storageKey, localDate);
    return true;
  } catch {
    return false;
  }
}
