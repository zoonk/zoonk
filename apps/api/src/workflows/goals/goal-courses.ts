import { type ServiceTier } from "@zoonk/ai/provider-options";
import { type CurriculumScope, getGraphCourseCountry } from "@zoonk/core/library/curriculum/scope";
import { type GoalProduct } from "@zoonk/core/library/products/goal-product";
import { type GoalKind } from "@zoonk/db";
import { type ContentAnalytics, toContentAnalytics } from "../_shared/content-analytics";
import {
  findGoalCourseStep,
  findGoalProductCourseStep,
  writeGoalCourseSearchTermsStep,
} from "./steps/goal-course-steps";

export async function findGoalCourses({
  analytics,
  courses,
  goal,
  product,
  provenance,
  resolved = {},
  scope,
  serviceTier,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  courses: readonly { key: string; title: string; countrySpecific?: boolean }[];
  goal: { kind: GoalKind };
  /** The product the graph was told about, so a graph built without it gets no product course. */
  product: GoalProduct | null;
  provenance: Parameters<typeof findGoalCourseStep>[0]["provenance"];
  resolved?: Readonly<Record<string, string>>;
  scope: CurriculumScope;
  /** For the search a learner waits on. */
  serviceTier?: ServiceTier;
  workflowRunId: string;
}): Promise<Record<string, string>> {
  const context = toContentAnalytics({ analytics, scope, workflowRunId });

  const found = await Promise.all(
    courses.map(async (course) => {
      const { key, title } = course;
      const courseScope = { ...scope, country: getGraphCourseCountry({ course, scope }) };
      const existing = resolved[key];

      if (existing) {
        return [key, existing] as const;
      }

      const input = { analytics: context, scope: courseScope, title };

      const productCourseId = product
        ? await findGoalProductCourseStep({ product, provenance, scope: courseScope, title })
        : null;

      if (productCourseId) {
        return [key, productCourseId] as const;
      }

      const searchTerms = await writeGoalCourseSearchTermsStep({ ...input, serviceTier });

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
