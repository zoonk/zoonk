"use client";

import { type LearnAdapters, LearnAdaptersContext } from "./learn-context";

export type { LearnAdapters } from "./learn-context";

/**
 * Injects the host app's links, analytics and API connection, so the
 * learning screens never import an app's routes, auth or data fetching. Wrap it
 * in `ModeProvider` to choose between Focus and Fun.
 */
export function LearnProvider({
  adapters,
  children,
}: {
  adapters: LearnAdapters;
  children: React.ReactNode;
}) {
  return <LearnAdaptersContext value={adapters}>{children}</LearnAdaptersContext>;
}
