"use client";

import { createContext } from "react";

export type Presentation = "line" | "panel" | "sheet";

export const PresentationContext = createContext<Presentation>("panel");
