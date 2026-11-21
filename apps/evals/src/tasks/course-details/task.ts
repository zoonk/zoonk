import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type CourseDetails,
  type CourseDetailsParams,
  generateCourseDetails,
} from "@zoonk/ai/tasks/courses/details";
import { readCriteria } from "../plain-language-criterion";
import {
  COURSE_DETAILS_SCORE_CATEGORIES,
  type CourseDetailsExpected,
  scoreCourseDetails,
} from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseDetailsTask: Task<
  OptionalCountry<CourseDetailsParams>,
  CourseDetails,
  CourseDetailsExpected
> = {
  criteria: readCriteria(COURSE_DETAILS_SCORE_CATEGORIES),
  description:
    "Write a shared course's public page from its outline: description, landing copy (the promise, audience and outcomes) and 1 or 2 catalog categories",
  generate: (input) => generateCourseDetails({ ...input, country: input.country ?? null }),
  id: "course-details",
  name: "Course details",
  priorities: {
    comparison: {
      criteria: {
        audience: "counts",
        fit: "counts",
        honesty: "counts",
        language: "counts",
        promise: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.shared,
      weights: { honesty: 3 },
    },
    distribution: "shared",
    first: "quality",
    reads: "Visitors and learners read the course page",
    reason: "Every visitor reads it, and a wrong promise is a broken one",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreCourseDetails,
  testCases: TEST_CASES,
};
