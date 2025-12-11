"use client";

import { NuqsAdapter } from "nuqs/adapters/next";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type CommandPaletteContextValue = {
  close: () => void;
  isOpen: boolean;
  open: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

/**
 * Hook to access the command palette state (open/close).
 * Must be used within a CommandPaletteProvider.
 */
export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within a CommandPaletteProvider",
    );
  }
  return context;
}

type CommandPaletteProviderProps = {
  children: React.ReactNode;
  /**
   * Keyboard shortcut key to toggle the command palette.
   * Used with Cmd (Mac) or Ctrl (Windows/Linux).
   * @default "k"
   */
  shortcutKey?: string;
};

/**
 * Provider that manages the command palette open/close state.
 * Also sets up the keyboard shortcut (Cmd+K / Ctrl+K by default).
 *
 * Includes NuqsAdapter for URL query state management.
 */
export function CommandPaletteProvider({
  children,
  shortcutKey = "k",
}: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((oldState) => !oldState);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [shortcutKey]);

  const value = useMemo(() => ({ close, isOpen, open }), [isOpen, open, close]);

  return (
    <NuqsAdapter>
      <CommandPaletteContext.Provider value={value}>
        {children}
      </CommandPaletteContext.Provider>
    </NuqsAdapter>
  );
}
