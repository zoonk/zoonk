import { useEffect, useEffectEvent } from "react";

type KeyboardModifiers = {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

/**
 * A custom hook that executes a callback when a keyboard shortcut is pressed.
 *
 * @param key The shortcut key to listen for (e.g., "Enter" for Cmd+Enter).
 * @param callback The function to call when the shortcut is pressed.
 * @param modifiers Optional modifiers to require (default: { metaKey: true, ctrlKey: true } - either works).
 */
export function useKeyboardCallback(
  key: string,
  callback: () => void,
  modifiers: KeyboardModifiers = { ctrlKey: true, metaKey: true },
) {
  const onKeyPress = useEffectEvent(() => {
    callback();
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== key) {
        return;
      }

      const modifierMatch =
        (modifiers.metaKey && event.metaKey) ||
        (modifiers.ctrlKey && event.ctrlKey) ||
        (modifiers.shiftKey && event.shiftKey) ||
        (modifiers.altKey && event.altKey);

      if (modifierMatch) {
        event.preventDefault();
        onKeyPress();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    key,
    modifiers.metaKey,
    modifiers.ctrlKey,
    modifiers.shiftKey,
    modifiers.altKey,
  ]);
}
