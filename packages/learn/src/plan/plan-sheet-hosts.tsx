"use client";

import { ChooseFocusHost } from "./plan-focus";
import { StudyEverythingHost } from "./study-everything";

/**
 * The sheets a plan screen holds for as long as it shows, so each stays on what its choice did
 * (with Undo) whatever opened it: "Study everything" (see `StudyEverythingHost`) and "Where to
 * focus" (see `ChooseFocusHost`). `openFullCourse` opens the first on arrival.
 */
export function PlanSheetHosts({
  children,
  openFullCourse = false,
}: {
  children: React.ReactNode;
  openFullCourse?: boolean;
}) {
  return (
    <StudyEverythingHost openOnArrival={openFullCourse}>
      <ChooseFocusHost>{children}</ChooseFocusHost>
    </StudyEverythingHost>
  );
}
