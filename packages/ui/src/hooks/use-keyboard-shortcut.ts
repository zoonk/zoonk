import { useEffect, useState } from "react";

/**
 * A custom hook that listens for a keyboard shortcut and opens a dialog.
 *
 * @param key The shortcut key to listen for (e.g., "k" for Cmd+K or Ctrl+K).
 */
export function useKeyboardShortcut(key: string) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === key && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((oldState) => !oldState);
      }
    };

    document.addEventListener("keydown", down);

    return () => document.removeEventListener("keydown", down);
  }, [key]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return { close, isOpen, open };
}
