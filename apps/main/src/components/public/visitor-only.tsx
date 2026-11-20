"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type ReactNode } from "react";

/** Nothing until the browser knows nobody is signed in: for parts that only show after a scroll. */
export function VisitorOnly({ children }: { children: ReactNode }) {
  return useLearnerSummary().status === "visitor" ? children : null;
}
