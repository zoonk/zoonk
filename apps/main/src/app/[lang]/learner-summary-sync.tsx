"use client";

import { ensureLearnerSummary } from "@/lib/learner/learner-store";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps the learner summary current as the learner moves: each page shown reads it when it isn't
 * there yet, failed before, or changed on its own since.
 */
export function LearnerSummarySync() {
  const pathname = usePathname();

  useEffect(() => {
    ensureLearnerSummary();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Each page shown checks the summary again.
  }, [pathname]);

  return null;
}
