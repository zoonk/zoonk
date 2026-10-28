import "server-only";
import { type CourseWeightsFinding } from "@zoonk/ai/tasks/v2/research/find-course-weights";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../cache/tags";
import { getCutoffTarget } from "../exams/cutoffs/cutoff-target";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { type CourseWeights, readCourseWeightSubjects } from "../plans/planner/course-weights";
import { refreshGoalPlan } from "../plans/refresh-goal-plan";

export type CourseWeightsLookup = {
  course: string;
  exam: string;
  examBlueprintId: string;
  institution: string;
  key: string;
  subjects: string[];
  year: number;
};

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isLookedUp({
  course,
  details,
  institution,
}: {
  course: string;
  details: Record<string, unknown>;
  institution: string;
}): boolean {
  const stored = isJsonObject(details.courseWeights) ? details.courseWeights : null;

  return (
    readText(stored?.course) !== null &&
    normalizeString(readText(stored?.course) ?? "") === normalizeString(course) &&
    normalizeString(readText(stored?.institution) ?? "") === normalizeString(institution)
  );
}

/** Workflow bridge: the goal comes from the research run that linked its notice. */
export async function findCourseWeightsLookup({
  goalId,
  year,
}: {
  goalId: string;
  year: number;
}): Promise<CourseWeightsLookup | null> {
  const goal = await prisma.goal.findUnique({
    select: { details: true, examBlueprint: true, kind: true },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint;
  const details = isJsonObject(goal?.details) ? goal.details : {};
  const target = blueprint ? getCutoffTarget({ details, role: blueprint.role }) : null;
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  if (
    goal?.kind !== "exam" ||
    !blueprint ||
    blueprint.ownerId ||
    !target?.course ||
    !target.institution ||
    !structure ||
    structure.subjects.length === 0 ||
    isLookedUp({ course: target.course, details, institution: target.institution })
  ) {
    return null;
  }

  return {
    course: target.course,
    exam: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
    examBlueprintId: blueprint.id,
    institution: target.institution,
    key: target.key,
    subjects: structure.subjects.map((subject) => subject.name),
    year,
  };
}

/** Writes only `courseWeights`, so answers the learner gives meanwhile are never overwritten. */
async function copyToGoal({
  goalId,
  lookup,
  stored,
}: {
  goalId: string;
  lookup: CourseWeightsLookup;
  stored: Pick<CourseWeights, "edition" | "status"> & {
    sourceTitle: string | null;
    sourceUrl: string | null;
    subjects: unknown;
  };
}): Promise<void> {
  const courseWeights: CourseWeights = {
    course: lookup.course,
    edition: stored.edition,
    institution: lookup.institution,
    source: stored.sourceUrl ? { title: stored.sourceTitle, url: stored.sourceUrl } : null,
    status: stored.status,
    subjects: readCourseWeightSubjects(stored.subjects),
  };

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return;
  }

  const marker = { planInputs: true, userId: goal.userId };

  const count = await writeLearnerChange(marker, async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE goals
      SET details = jsonb_set(details, '{courseWeights}', ${JSON.stringify(courseWeights)}::jsonb),
        updated_at = ${new Date()}
      WHERE id = ${goalId}::uuid
        AND details->'courseWeights' IS DISTINCT FROM ${JSON.stringify(courseWeights)}::jsonb
    `;

    return updated > 0 ? updated : unchanged(0);
  });

  if (count > 0) {
    await refreshGoalPlan({ goalId });
    revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
  }
}

/** Workflow bridge: the lookup comes from `findCourseWeightsLookup`. */
export async function copyStoredCourseWeights({
  goalId,
  lookup,
}: {
  goalId: string;
  lookup: CourseWeightsLookup;
}): Promise<boolean> {
  const stored = await prisma.examCourseWeights.findUnique({
    where: {
      blueprintTargetYear: {
        examBlueprintId: lookup.examBlueprintId,
        targetKey: lookup.key,
        year: lookup.year,
      },
    },
  });

  if (!stored) {
    return false;
  }

  await copyToGoal({ goalId, lookup, stored });
  return true;
}

/**
 * Workflow bridge: the lookup comes from `findCourseWeightsLookup`. Two lookups at once keep the
 * first answer.
 */
export async function recordCourseWeights({
  finding,
  goalId,
  lookup,
  provenance,
}: {
  finding: CourseWeightsFinding;
  goalId: string;
  lookup: CourseWeightsLookup;
  provenance: { model: string; promptVersion: string; runId: string };
}): Promise<void> {
  const subjects = lookup.subjects.flatMap((name, index) => {
    const weight = finding.weights[index];
    return weight === undefined ? [] : [{ name, weight }];
  });

  const found = finding.status === "found" && subjects.length === lookup.subjects.length;

  await prisma.examCourseWeights.createMany({
    data: {
      edition: found ? finding.edition : null,
      examBlueprintId: lookup.examBlueprintId,
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
      sourceTitle: found ? finding.source.title : null,
      sourceUrl: found ? finding.source.url : null,
      status: found ? "found" : "unknown",
      subjects: found ? subjects : [],
      targetKey: lookup.key,
      year: lookup.year,
    },
    skipDuplicates: true,
  });

  await copyStoredCourseWeights({ goalId, lookup });
}
