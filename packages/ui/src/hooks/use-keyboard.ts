import {
  type KeyboardEvent as ReactKeyboardEvent,
  use,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { SHORTCUTS, type ShortcutName, isModShortcut, shortcutKeys } from "../lib/shortcuts";
import { PopupShortcutLayer } from "./_utils/popup-shortcut-layer";
import {
  SCREEN_ENTER_ATTRIBUTE,
  getNumberKeyIndex,
  isScreenShortcut,
} from "./_utils/screen-shortcut";

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
  "aria-keyshortcuts": shortcutKeys("audio"),
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

function useKeyboardCallback(
  keys: readonly string[],
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
      if (!keys.includes(event.key)) {
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
  }, [keys, mode, screen, inPopup, altKey, ctrlKey, metaKey, shiftKey]);
}

const MOD_KEY = { mode: "any", modifiers: { ctrlKey: true, metaKey: true } } as const;
const SCREEN_KEY = { mode: "none", screen: true } as const;
const FIELD_KEY = { mode: "none" } as const;

/**
 * Answers one of `SHORTCUTS`. A screen's key leaves itself to a field or a control in focus and
 * acts once however long it's held; `fromField` answers from inside a field too, for a screen whose
 * only field always has focus. Return `false` when the action can't run, so the key keeps its
 * default.
 */
export function useShortcut(
  name: ShortcutName,
  callback: (event: KeyboardEvent) => ShortcutResult,
  { enabled = true, fromField = false }: { enabled?: boolean; fromField?: boolean } = {},
) {
  const screenKey = fromField ? FIELD_KEY : SCREEN_KEY;

  useKeyboardCallback(
    SHORTCUTS[name].keys,
    (event) => (enabled ? callback(event) : false),
    isModShortcut(name) ? MOD_KEY : screenKey,
  );
}

/** A held Enter presses a focused button once, as it acts once on the screen. */
export function useHeldEnterOnce() {
  useKeyboardCallback(SHORTCUTS.main.keys, (event) => {
    if (!event.repeat || !(event.target instanceof HTMLButtonElement)) {
      return false;
    }
  });
}

/** A control one screen size hides (`lg:hidden`) answers no key: a key presses only what is drawn. */
function isDrawn(element: HTMLElement | null): element is HTMLElement {
  return element !== null && element.getClientRects().length > 0;
}

/** Return `false` when the action can't run, so Enter keeps its default. */
export function useEnterKey(
  callback: () => ShortcutResult,
  { enabled = true }: { enabled?: boolean } = {},
) {
  useShortcut("main", callback, { enabled });
}

export function useEnterClick<Target extends HTMLElement>({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const ref = useRef<Target>(null);

  useEnterKey(
    () => {
      if (!isDrawn(ref.current)) {
        return false;
      }

      ref.current.click();
    },
    { enabled },
  );

  return ref;
}

/** P plays or pauses the screen's audio. Spread the result on its button: Enter there runs the screen's main action, and plays only when there's none. */
export function useAudioKey(toggle: () => ShortcutResult) {
  useShortcut("audio", toggle);
  return AUDIO_BUTTON;
}

/**
 * Esc presses the control it's given, so it does exactly what a click there does (a question
 * before leaving included) and nothing when the control isn't drawn.
 */
export function useEscapeClick<Target extends HTMLElement>({
  enabled = true,
  fromField = false,
}: { enabled?: boolean; fromField?: boolean } = {}) {
  const ref = useRef<Target>(null);

  useShortcut(
    "leave",
    () => {
      if (!isDrawn(ref.current)) {
        return false;
      }

      ref.current.click();
    },
    { enabled, fromField },
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
