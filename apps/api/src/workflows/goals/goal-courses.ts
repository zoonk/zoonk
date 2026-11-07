import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type GoalProduct } from "@zoonk/core/library/products/goal-product";
import { type GoalKind } from "@zoonk/db";
import { type ContentAnalytics, toContentAnalytics } from "../_shared/content-analytics";
import { findGoalCourseStep, writeGoalCourseSearchTermsStep } from "./steps/goal-course-steps";

export async function findGoalCourses({
  analytics,
  courses,
  goal,
  product,
  provenance,
  resolved = {},
  scope,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  courses: readonly { key: string; title: string }[];
  goal: { kind: GoalKind };
  /** The product the graph was told about, so a graph built without it gets no product course. */
  product: GoalProduct | null;
  provenance: Parameters<typeof findGoalCourseStep>[0]["provenance"];
  resolved?: Readonly<Record<string, string>>;
  scope: CurriculumScope;
  workflowRunId: string;
}): Promise<Record<string, string>> {
  const context = toContentAnalytics({ analytics, scope, workflowRunId });

  const found = await Promise.all(
    courses.map(async ({ key, title }) => {
      const existing = resolved[key];

      if (existing) {
        return [key, existing] as const;
      }

      const input = { analytics: context, scope, title };
      const searchTerms = await writeGoalCourseSearchTermsStep(input);

      const id = await findGoalCourseStep({
        ...input,
        kind: goal.kind,
        product,
        provenance,
        searchTerms,
      });

      return [key, id] as const;
    }),
  );

  return Object.fromEntries(found);
}
