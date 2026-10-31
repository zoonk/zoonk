"use client";

import { ChooseFocusHost } from "./plan-focus";
import { StudyEverythingHost } from "./study-everything";

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
