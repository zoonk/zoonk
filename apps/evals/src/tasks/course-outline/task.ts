import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type CourseOutlineParams,
  generateCourseOutline,
} from "@zoonk/ai/tasks/curriculum/course-outline";
import { readCriteria } from "../plain-language-criterion";
import { COURSE_OUTLINE_SCORE_CATEGORIES } from "./score-categories";
import { type CourseOutlineExpected, scoreCourseOutline } from "./scorer";
import { TEST_CASES } from "./test-cases";

type CourseOutlineOutput = Awaited<ReturnType<typeof generateCourseOutline>>["data"];

export const courseOutlineTask: Task<
  OptionalCountry<CourseOutlineParams>,
  CourseOutlineOutput,
  CourseOutlineExpected
> = {
  criteria: readCriteria(COURSE_OUTLINE_SCORE_CATEGORIES),
  description:
    "Write one level band of a shared course: chapters with objectives and tools, and every lesson's title, description, can-do line, minutes and skills",
  generate: (input) => generateCourseOutline({ ...input, country: input.country ?? null }),
  id: "course-outline",
  name: "Course outline",
  priorities: {
    comparison: {
      criteria: {
        aiEraSkills: "counts",
        coverage: "counts",
        granularity: "counts",
        levelFit: "counts",
        noFiller: "counts",
        order: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.core,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner reads the chapters; lesson writers build on them",
    reason: "Shared courses are reused, so coverage is worth paying for",
    waits: "A learner waits on the band they start with; other bands are prepared ahead",
  },
  score: scoreCourseOutline,
  testCases: TEST_CASES,
};
