import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type CourseIdentitySchema } from "@zoonk/ai/tasks/courses/identity";
import { getString, isJsonObject } from "@zoonk/utils/json";

export type CourseIdentityExpected = Pick<CourseIdentitySchema, "courseSlug" | "decision">;

type GeneratedCourseIdentity = { courseSlug: string | null | undefined; decision: string | null };

/**
 * Reads only the two identity fields that determine correctness. The generated
 * reason is intentionally ignored because it explains the decision without
 * changing which course the learner should use.
 */
function getGeneratedCourseIdentity(output: string): GeneratedCourseIdentity {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed)) {
      return { courseSlug: undefined, decision: null };
    }

    const courseSlug = parsed.courseSlug;

    const validCourseSlug =
      typeof courseSlug === "string" || courseSlug === null ? courseSlug : undefined;

    return { courseSlug: validCourseSlug, decision: getString(parsed, "decision") };
  } catch {
    return { courseSlug: undefined, decision: null };
  }
}

/**
 * Preserves the task's existing partial-credit contract while making it
 * independent from a judge model: both fields earn 10, one earns 7, and no
 * matches earn 6.
 */
function getIdentityScore({
  courseSlugMatches,
  decisionMatches,
}: {
  courseSlugMatches: boolean;
  decisionMatches: boolean;
}): number {
  if (courseSlugMatches && decisionMatches) {
    return 10;
  }

  if (courseSlugMatches || decisionMatches) {
    return 7;
  }

  return 6;
}

/**
 * Formats nullable slugs without conflating an intentional null with a missing
 * or wrongly typed field, which must count as a mismatch for create-new cases.
 */
function getCourseSlugLabel(courseSlug: string | null | undefined): string {
  if (courseSlug === undefined) {
    return "missing or invalid";
  }

  return courseSlug === null ? "`null`" : `\`${courseSlug}\``;
}

/**
 * Scores course identity deterministically from decision and courseSlug while
 * allowing the explanatory reason field to vary freely.
 */
export const scoreCourseIdentity: TaskScorer<CourseIdentityExpected> = ({ output, testCase }) => {
  const generated = getGeneratedCourseIdentity(output);
  const expected = testCase.expected;
  const decisionMatches = Boolean(expected && generated.decision === expected.decision);

  const courseSlugMatches = Boolean(
    expected && generated.courseSlug !== undefined && generated.courseSlug === expected.courseSlug,
  );

  const score = getIdentityScore({ courseSlugMatches, decisionMatches });

  if (score === 10) {
    return createFixedScore({ conclusion: "None", score });
  }

  const details = [
    expected
      ? `Expected decision \`${expected.decision}\` and courseSlug ${getCourseSlugLabel(expected.courseSlug)}.`
      : "Expected decision and courseSlug were missing from the test case.",
    generated.decision
      ? `Generated decision \`${generated.decision}\`.`
      : "Generated output did not include a string decision.",
    `Generated courseSlug ${getCourseSlugLabel(generated.courseSlug)}.`,
  ];

  return createFixedScore({ conclusion: details.join(" "), score });
};
