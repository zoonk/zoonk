import { useEffect, useEffectEvent } from "react";

type KeyboardModifiers = {
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
};

type ModifierMode = "all" | "any" | "none";

function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return false;
}

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

function checkModifiers(
  event: KeyboardEvent,
  modifiers: KeyboardModifiers | undefined,
  mode: ModifierMode,
): boolean {
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
 * @example
 * // Cmd+K OR Ctrl+K (cross-platform toggle)
 * useKeyboardCallback("k", toggle, {
 *   mode: "any",
 *   modifiers: { ctrlKey: true, metaKey: true },
 * });
 *
 * @example
 * // Cmd+Shift+P (both modifiers required)
 * useKeyboardCallback("p", openPalette, {
 *   modifiers: { metaKey: true, shiftKey: true },
 * });
 *
 * @example
 * // Just Enter, no modifiers allowed
 * useKeyboardCallback("Enter", submit, { mode: "none" });
 *
 * @example
 * // Any Enter (modifiers don't matter)
 * useKeyboardCallback("Enter", submit);
 *
 * @example
 * // Escape key without modifiers
 * useKeyboardCallback("Escape", close, { mode: "none" });
 */
export function useKeyboardCallback(
  key: string,
  callback: () => void,
  options: {
    /**
     * Skip the callback when the event target is an input, textarea, or contenteditable element.
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
  } = {},
) {
  const { ignoreEditable = false, mode = "all", modifiers } = options;
  const { altKey, ctrlKey, metaKey, shiftKey } = modifiers ?? {};

  const onKeyPress = useEffectEvent(() => {
    callback();
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== key) {
        return;
      }

      if (ignoreEditable && isEditableTarget(event.target)) {
        return;
      }

      const mods = { altKey, ctrlKey, metaKey, shiftKey };

      if (checkModifiers(event, mods, mode)) {
        event.preventDefault();
        onKeyPress();
      }
    }

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [key, mode, ignoreEditable, altKey, ctrlKey, metaKey, shiftKey]);
}
