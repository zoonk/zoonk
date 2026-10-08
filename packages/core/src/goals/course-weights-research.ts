import "server-only";
import { type CourseWeightsFinding } from "@zoonk/ai/tasks/v2/research/find-course-weights";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../cache/tags";
import { examStructureSchema } from "../library/exams/blueprint-contract";
import { type CourseWeights } from "../plans/planner/course-weights";

/** What research needs to look up how the learner's course weighs the exam's parts. */
export type CourseWeightsLookup = {
  course: string;
  exam: string;
  institution: string;
  subjects: string[];
};

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Whether the goal's details already say what the lookup found (or didn't) for this course. */
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

/**
 * The lookup an entrance exam goal needs for its course's weights: the course and institution the
 * learner named (Medicina, UFMG) and the parts of the exam's shared notice. Null when the goal
 * names no course or no institution (weights differ by institution, and a guess isn't a weight),
 * has no shared notice with parts, or was already looked up for that course and institution.
 *
 * This is a workflow bridge: the goal comes from the research run that linked its notice.
 */
export async function findCourseWeightsLookup({
  goalId,
}: {
  goalId: string;
}): Promise<CourseWeightsLookup | null> {
  const goal = await prisma.goal.findUnique({
    select: { details: true, examBlueprint: true, kind: true },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint;
  const details = isJsonObject(goal?.details) ? goal.details : {};
  const course = readText(details.targetCourse);
  const institution = readText(details.institution);
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  if (
    goal?.kind !== "exam" ||
    !blueprint ||
    blueprint.ownerId ||
    !course ||
    !institution ||
    !structure ||
    structure.subjects.length === 0 ||
    isLookedUp({ course, details, institution })
  ) {
    return null;
  }

  return {
    course,
    exam: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
    institution,
    subjects: structure.subjects.map((subject) => subject.name),
  };
}

/**
 * Stores on the goal's details (`courseWeights`) what the lookup found for the parts it was given,
 * in their order, or that it found nothing, so it isn't looked up again for the same course and
 * institution; the planner weighs the exam's parts by it (see `weighGraphByCourse`). Only that
 * key is written, so answers the learner gives meanwhile are never overwritten.
 *
 * This is a workflow bridge: the goal comes from the research run that looked it up.
 */
export async function recordCourseWeights({
  finding,
  goalId,
  lookup,
}: {
  finding: CourseWeightsFinding;
  goalId: string;
  lookup: CourseWeightsLookup;
}): Promise<void> {
  const subjects = lookup.subjects.flatMap((name, index) => {
    const weight = finding.weights[index];
    return weight === undefined ? [] : [{ name, weight }];
  });

  const found = finding.status === "found" && subjects.length === lookup.subjects.length;

  const courseWeights: CourseWeights = {
    course: lookup.course,
    edition: found ? finding.edition : null,
    institution: lookup.institution,
    source: found ? finding.source : null,
    status: found ? "found" : "unknown",
    subjects: found ? subjects : [],
  };

  const updated = await prisma.$queryRaw<{ user_id: string }[]>`
    UPDATE goals
    SET details = jsonb_set(details, '{courseWeights}', ${JSON.stringify(courseWeights)}::jsonb),
      updated_at = ${new Date()}
    WHERE id = ${goalId}::uuid
    RETURNING user_id
  `;

  const [goal] = updated;

  if (goal) {
    revalidateCacheTags([getGoalsCacheTag(goal.user_id)]);
  }
}
