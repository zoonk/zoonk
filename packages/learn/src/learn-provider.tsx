"use client";

import { type LearnAdapters, LearnAdaptersContext } from "./learn-context";

export type { LearnAdapters } from "./learn-context";

export function LearnProvider({
  adapters,
  children,
}: {
  adapters: LearnAdapters;
  children: React.ReactNode;
}) {
  return <LearnAdaptersContext value={adapters}>{children}</LearnAdaptersContext>;
}
