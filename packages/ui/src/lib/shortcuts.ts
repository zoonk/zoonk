type Shortcut = {
  /** What the keycap shows; a `mod` shortcut gets ⌘ or Ctrl before it. */
  cap: string;
  /** What the key does, for the design site's Keyboard page. */
  does: string;
  /** `KeyboardEvent.key` values. */
  keys: readonly string[];
  /** Pressed with ⌘ on an Apple keyboard and Ctrl on the others. */
  mod?: true;
};

const NUMBER_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * Every key the product answers beyond the control in focus. The handlers in
 * `@zoonk/ui/hooks/keyboard`, `ShortcutKbd` and `shortcutKeys` (for `aria-keyshortcuts`) all read
 * it, and `scripts/verify/shortcut-keys.test.mts` fails on a key bound or drawn anywhere else.
 */
export const SHORTCUTS = {
  answerBlank: { cap: "↓", does: "On a true or false card: leave it blank", keys: ["ArrowDown"] },
  answerFalse: { cap: "←", does: "On a true or false card: answer False", keys: ["ArrowLeft"] },
  answerTrue: { cap: "→", does: "On a true or false card: answer True", keys: ["ArrowRight"] },
  audio: { cap: "P", does: "Play or pause the screen's audio", keys: ["p", "P"] },
  flag: { cap: "F", does: "Flag this question in a mock exam", keys: ["f", "F"] },
  leave: {
    cap: "Esc",
    does: "Close what is open; with nothing open, do what ✕ or the way back on screen does",
    keys: ["Escape"],
  },
  main: { cap: "⏎", does: "Press the screen's main action", keys: ["Enter"] },
  next: { cap: "→", does: "Go to the next screen, question or map", keys: ["ArrowRight"] },
  pick: { cap: "1 to 9", does: "Pick the option with that number", keys: NUMBER_KEYS },
  previous: { cap: "←", does: "Go to the previous screen, question or map", keys: ["ArrowLeft"] },
  save: { cap: "S", does: "Save this mind map", keys: ["s", "S"] },
  search: { cap: "K", does: "Search or ask, on every page", keys: ["k"], mod: true },
  sidebar: { cap: "B", does: "Collapse or expand the sidebar on screen", keys: ["b"], mod: true },
  tap: { cap: "Space", does: "Tap the beat", keys: [" "] },
} as const satisfies Record<string, Shortcut>;

export type ShortcutName = keyof typeof SHORTCUTS;

export function isModShortcut(name: ShortcutName): boolean {
  return "mod" in SHORTCUTS[name];
}

function keyName(key: string): string {
  if (key === " ") {
    return "Space";
  }

  return key.length === 1 ? key.toUpperCase() : key;
}

/** How many options number keys reach. */
export const MAX_PICK_KEYS = NUMBER_KEYS.length;

/** The number key that picks the option at `index`, or null past the ninth. */
export function pickKey(index: number): string | null {
  return NUMBER_KEYS[index] ?? null;
}

/**
 * The value for `aria-keyshortcuts`. With `index`, the one number key that picks that option
 * (undefined past the ninth).
 */
export function shortcutKeys(name: ShortcutName, index?: number): string | undefined {
  if (index !== undefined) {
    return pickKey(index) ?? undefined;
  }

  const names = [...new Set(SHORTCUTS[name].keys.map((key) => keyName(key)))];

  if (isModShortcut(name)) {
    return names.flatMap((key) => [`Meta+${key}`, `Control+${key}`]).join(" ");
  }

  return names.join(" ");
}
