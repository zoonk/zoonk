"use client";

import { reloadOnAuthChange } from "@/lib/auth/auth-change";
import { useEffect } from "react";

/**
 * Reloads the page when the browser's session changes in another tab, so a page drawn for one
 * learner never stays on screen for the next (`lib/auth/auth-change.ts`). Draws nothing.
 */
export function AuthChangeReload() {
  useEffect(() => reloadOnAuthChange(), []);

  return null;
}
