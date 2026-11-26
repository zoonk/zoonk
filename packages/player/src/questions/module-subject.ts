"use client";

import { createContext, use } from "react";

/** A plan that isn't for an exam calls its subjects modules, so the tutor's labels about one say "module". */
export const ModuleSubjectContext = createContext(false);

export function useModuleSubject(): boolean {
  return use(ModuleSubjectContext);
}
