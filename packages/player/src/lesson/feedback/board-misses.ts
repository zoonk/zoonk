"use client";

import { createContext } from "react";

/**
 * How a language step's match board hands the verdict under it the pairs the learner first
 * confused: only the board saw its wrong tries. The screen that draws both holds them.
 */
export const BoardMissesContext = createContext<((misses: React.ReactNode) => void) | null>(null);
