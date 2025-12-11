"use client";

import { Button } from "@zoonk/ui/components/button";
import { Search } from "lucide-react";
import { useExtracted } from "next-intl";
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
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within a CommandPaletteProvider",
    );
  }
  return context;
}

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((oldState) => !oldState);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const value = useMemo(() => ({ close, isOpen, open }), [isOpen, open, close]);

  return (
    <NuqsAdapter>
      <CommandPaletteContext.Provider value={value}>
        {children}
      </CommandPaletteContext.Provider>
    </NuqsAdapter>
  );
}

export function CommandPaletteTrigger() {
  const t = useExtracted();
  const { open } = useCommandPalette();

  return (
    <Button
      aria-keyshortcuts="Meta+K Control+K"
      onClick={open}
      size="icon"
      variant="outline"
    >
      <Search />
      <span className="sr-only">{t("Search")}</span>
    </Button>
  );
}
