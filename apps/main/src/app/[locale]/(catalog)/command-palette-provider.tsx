"use client";

import { CommandPaletteProvider } from "@zoonk/next/patterns/command-palette/command-palette-provider";

export function CatalogCommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
