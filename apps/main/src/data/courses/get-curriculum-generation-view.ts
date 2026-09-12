import { getCourseCurriculumGenerationView } from "@zoonk/core/workflows/course-curriculum-generation-access";
import { cache } from "react";

/** Empty course surfaces share the same session-bound eligibility read. */
export const getCurriculumGenerationView = cache((courseId: string) =>
  getCourseCurriculumGenerationView({ courseId }),
);
