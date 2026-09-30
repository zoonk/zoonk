import { use, useEffectEvent, useLayoutEffect, useRef } from "react";
import { PopupShortcutLayer } from "./_utils/popup-shortcut-layer";
import { getNumberKeyIndex, isEditableTarget, isScreenShortcut } from "./_utils/screen-shortcut";

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

/**
 * A custom hook that executes a callback when a keyboard shortcut is pressed.
 *
 * @param key The shortcut key to listen for.
 * @param callback The function to call when the shortcut is pressed.
 * @param options Optional configuration for modifier keys and matching mode.
 *
 * Callbacks return `void` (handled — `preventDefault` is called) or
 * `false` (not handled — `preventDefault` is skipped).
 *
 * @example
 * // Cmd+K OR Ctrl+K (cross-platform toggle)
 * useKeyboardCallback("k", () => toggle(), {
 *   mode: "any",
 *   modifiers: { ctrlKey: true, metaKey: true },
 * });
 *
 * @example
 * // Just Enter, no modifiers allowed
 * useKeyboardCallback("Enter", () => submit(), { mode: "none" });
 *
 * @example
 * // Conditionally handle — return false to skip preventDefault
 * useKeyboardCallback("ArrowRight", () => {
 *   if (!canNavigate) return false;
 *   goNext();
 * }, { mode: "none" });
 */
export function useKeyboardCallback(
  key: string,
  callback: () => ShortcutResult,
  options: {
    /**
     * Skip the callback when the event target is an input, textarea, select, or contenteditable element.
     */
    ignoreEditable?: boolean;
    /**
     * How to match modifiers:
     * - "all": ALL specified modifiers must be pressed (AND) — default
     * - "any": ANY specified modifier triggers (OR)
     * - "none": NO modifier keys can be pressed
     */
    mode?: ModifierMode;
    /**
     * Modifiers to check. If undefined/empty, modifiers are ignored (just the key matters).
     */
    modifiers?: KeyboardModifiers;
    /**
     * A screen's own shortcut, such as Enter to continue or an arrow to the next screen, rather
     * than an app-wide one: it leaves the key to the control in focus (a field, a dialog or menu,
     * Enter on a button or a link) and acts once however long the key is held.
     */
    screen?: boolean;
  } = {},
) {
  const { ignoreEditable = false, mode = "all", modifiers, screen = false } = options;
  const inPopup = use(PopupShortcutLayer);
  const { altKey, ctrlKey, metaKey, shiftKey } = modifiers ?? {};

  const onKeyPress = useEffectEvent((event: KeyboardEvent) => {
    const handled = callback();

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

      if (ignoreEditable && isEditableTarget(event.target)) {
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
  }, [key, mode, ignoreEditable, screen, inPopup, altKey, ctrlKey, metaKey, shiftKey]);
}

/**
 * Enter runs the screen's main action (continue, check, start), keyboard first. A focused button
 * or link keeps its own Enter, and so do fields, dialogs and menus. Return `false` when the
 * action can't run, so Enter keeps its default.
 */
export function useEnterKey(
  callback: () => ShortcutResult,
  { enabled = true }: { enabled?: boolean } = {},
) {
  useKeyboardCallback("Enter", () => (enabled ? callback() : false), {
    mode: "none",
    screen: true,
  });
}

/**
 * For a screen whose next step is a link (or a button elsewhere on the page): Enter presses the
 * element this ref is on, as if it had focus.
 */
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

/**
 * Number keys 1 to 9 pick the screen's options, as fast as a tap. Digits typed in a field, or
 * pressed inside a dialog or a menu, stay there. Return `false` from `onPick` for a key that
 * picked nothing.
 */
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

  // Before paint, like `useKeyboardCallback`: a question's number keys work once it shows.
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
