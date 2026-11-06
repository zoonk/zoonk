import {
  type KeyboardEvent as ReactKeyboardEvent,
  use,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { PopupShortcutLayer } from "./_utils/popup-shortcut-layer";
import {
  SCREEN_ENTER_ATTRIBUTE,
  getNumberKeyIndex,
  isScreenShortcut,
} from "./_utils/screen-shortcut";

export const AUDIO_KEY = "p";

/**
 * A held Enter acts once, as screen shortcuts do: put it on a control whose own Enter would act
 * again on each repeat, such as a button or a field that submits its form.
 */
export function ignoreHeldEnter(event: ReactKeyboardEvent) {
  if (event.key === "Enter" && event.repeat) {
    event.preventDefault();
  }
}

const AUDIO_BUTTON = {
  [SCREEN_ENTER_ATTRIBUTE]: "",
  "aria-keyshortcuts": AUDIO_KEY,
  onKeyDown: ignoreHeldEnter,
} as const;

type KeyboardModifiers = {
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

type ModifierMode = "all" | "any" | "none";

/** `void` means handled, `false` means not handled (`preventDefault` is skipped). */
// oxlint-disable-next-line @typescript-eslint/no-invalid-void-type -- `void` is the correct return type here; `undefined` breaks contextual typing for callbacks like `() => toggle()`
type ShortcutResult = false | void;

function hasAnyModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function getModifierChecks(event: KeyboardEvent, modifiers: KeyboardModifiers): boolean[] {
  const checks: boolean[] = [];

  if (modifiers.altKey !== undefined) {
    checks.push(modifiers.altKey === event.altKey);
  }

  if (modifiers.ctrlKey !== undefined) {
    checks.push(modifiers.ctrlKey === event.ctrlKey);
  }

  if (modifiers.metaKey !== undefined) {
    checks.push(modifiers.metaKey === event.metaKey);
  }

  if (modifiers.shiftKey !== undefined) {
    checks.push(modifiers.shiftKey === event.shiftKey);
  }

  return checks;
}

function checkModifiers({
  event,
  mode,
  modifiers,
}: {
  event: KeyboardEvent;
  mode: ModifierMode;
  modifiers?: KeyboardModifiers;
}): boolean {
  if (mode === "none") {
    return !hasAnyModifier(event);
  }

  if (!modifiers || Object.keys(modifiers).length === 0) {
    return true;
  }

  const checks = getModifierChecks(event, modifiers);

  if (mode === "any") {
    return checks.some(Boolean);
  }

  return checks.every(Boolean);
}

export function useKeyboardCallback(
  key: string,
  callback: (event: KeyboardEvent) => ShortcutResult,
  options: {
    /** `all` (the default) needs every modifier, `any` one of them, `none` no modifier at all. */
    mode?: ModifierMode;
    /** With none given, only the key matters. */
    modifiers?: KeyboardModifiers;
    /** Leaves the key to the control in focus and acts once however long the key is held. */
    screen?: boolean;
  } = {},
) {
  const { mode = "all", modifiers, screen = false } = options;
  const inPopup = use(PopupShortcutLayer);
  const { altKey, ctrlKey, metaKey, shiftKey } = modifiers ?? {};

  const onKeyPress = useEffectEvent((event: KeyboardEvent) => {
    const handled = callback(event);

    if (handled !== false) {
      event.preventDefault();
    }
  });

  // Before paint, so a key pressed as soon as its screen shows already works.
  useLayoutEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== key) {
        return;
      }

      if (screen && !isScreenShortcut(event, { inPopup })) {
        return;
      }

      const mods = { altKey, ctrlKey, metaKey, shiftKey };

      if (checkModifiers({ event, mode, modifiers: mods })) {
        onKeyPress(event);
      }
    }

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [key, mode, screen, inPopup, altKey, ctrlKey, metaKey, shiftKey]);
}

/** Return `false` when the action can't run, so Enter keeps its default. */
export function useEnterKey(
  callback: () => ShortcutResult,
  { enabled = true }: { enabled?: boolean } = {},
) {
  useKeyboardCallback("Enter", () => (enabled ? callback() : false), {
    mode: "none",
    screen: true,
  });
}

export function useEnterClick<Target extends HTMLElement>({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const ref = useRef<Target>(null);

  useEnterKey(
    () => {
      if (!ref.current) {
        return false;
      }

      ref.current.click();
    },
    { enabled },
  );

  return ref;
}

/** A screen's letter key, pressed in either case because Caps Lock sends the capital. */
export function useLetterKey(letter: string, callback: () => ShortcutResult) {
  const options = { mode: "none", screen: true } as const;
  useKeyboardCallback(letter, callback, options);
  useKeyboardCallback(letter.toUpperCase(), callback, options);
}

/** P plays or pauses the screen's audio. Spread the result on its button: Enter there runs the screen's main action, and plays only when there's none. */
export function useAudioKey(toggle: () => ShortcutResult) {
  useLetterKey(AUDIO_KEY, toggle);
  return AUDIO_BUTTON;
}

/** Only for a full-screen task whose leaving loses nothing. */
export function useEscapeClick<Target extends HTMLElement>({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const ref = useRef<Target>(null);

  useKeyboardCallback(
    "Escape",
    () => {
      if (!enabled || !ref.current) {
        return false;
      }

      ref.current.click();
    },
    { mode: "none", screen: true },
  );

  return ref;
}

/** Return `false` from `onPick` for a key that picked nothing. */
export function useNumberKeys({
  count,
  enabled = true,
  onPick,
}: {
  count: number;
  enabled?: boolean;
  onPick: (index: number) => ShortcutResult;
}) {
  const pick = useEffectEvent(onPick);
  const inPopup = use(PopupShortcutLayer);

  // Before paint, like `useKeyboardCallback`: a question's keys work once it shows.
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const index = getNumberKeyIndex(event);

      if (index === null || index >= count || !isScreenShortcut(event, { inPopup })) {
        return;
      }

      if (pick(index) !== false) {
        event.preventDefault();
      }
    }

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [count, enabled, inPopup]);
}
