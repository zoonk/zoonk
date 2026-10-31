"use client";

import { ensureLearnerSummary } from "@/lib/learner/learner-store";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function LearnerSummarySync() {
  const pathname = usePathname();

  useEffect(() => {
    ensureLearnerSummary();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Each page shown checks the summary again.
  }, [pathname]);

  return null;
}
