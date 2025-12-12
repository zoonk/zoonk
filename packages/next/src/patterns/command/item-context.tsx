"use client";

import { createContext, useContext } from "react";

type CommandPaletteItemContextValue = {
  onSelect: (url: string) => void;
};

const CommandPaletteItemContext =
  createContext<CommandPaletteItemContextValue | null>(null);

export function CommandPaletteItemProvider({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: (url: string) => void;
}) {
  return (
    <CommandPaletteItemContext.Provider value={{ onSelect }}>
      {children}
    </CommandPaletteItemContext.Provider>
  );
}

/**
 * Hook to access the command palette item selection handler.
 * Use this in client components rendered inside the command palette
 * to trigger navigation when an item is selected.
 */
export function useCommandPaletteSelect() {
  const context = useContext(CommandPaletteItemContext);
  if (!context) {
    throw new Error(
      "useCommandPaletteSelect must be used within CommandPaletteItemProvider",
    );
  }
  return context.onSelect;
}
