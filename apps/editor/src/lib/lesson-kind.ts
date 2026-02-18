import { type LessonKind } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";

export function getLessonKind(params: {
  orgSlug?: string;
  courseCategories: string[];
}): LessonKind {
  if (params.orgSlug !== AI_ORG_SLUG) {
    return "custom";
  }

  if (params.courseCategories.includes("languages")) {
    return "language";
  }

  return "core";
}
