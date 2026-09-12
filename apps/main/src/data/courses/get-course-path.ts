import { getCourseLearningPath } from "@zoonk/core/courses/learning-plan";
import { cache } from "react";

/** The sidebar and chapter collection share the same request-specific path snapshot. */
export const getCoursePath = cache((courseId: string) => getCourseLearningPath({ courseId }));
