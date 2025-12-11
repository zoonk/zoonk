"use client";

import { CommandPaletteProvider } from "@zoonk/next/patterns/command";

export function CatalogCommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
