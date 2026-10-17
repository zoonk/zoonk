"use client";

import { type PlanCourseLevel } from "@zoonk/core/plans/course-contract";
import { useExtracted } from "next-intl";

type CourseLevel = PlanCourseLevel["level"];

/** A course level as the learner reads it: Overview, Beginner, Intermediate or Advanced. */
export function useLevelName() {
  const t = useExtracted();

  return (level: CourseLevel): string => {
    switch (level) {
      case "overview":
        return t("Overview");
      case "beginner":
        return t("Beginner");
      case "intermediate":
        return t("Intermediate");
      case "advanced":
        return t("Advanced");
      default:
        return t("Overview");
    }
  };
}
