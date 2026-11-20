import "server-only";
import { AnyNull, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { getCourseCacheTag } from "../../cache/tags";
import {
  type CourseEditionPair,
  courseContentLanguage,
  getCourseEditionProblem,
  joinCourseEditionFamily,
  readCourseEditionPair,
} from "../../courses/_utils/course-edition-family";
import { parsePlanGraph } from "../../plans/planner/plan-state";

type LinkTarget = { courseId: string; goalId?: never } | { courseId?: never; goalId: string };

async function findResolvedPair(target: LinkTarget) {
  const goals = await prisma.goal.findMany({
    select: {
      details: true,
      language: true,
      plan: { select: { graph: true } },
      primaryCourseId: true,
    },
    where: {
      details: { not: AnyNull, path: ["courseStartSourceId"] },
      id: target.goalId,
      primaryCourseId: target.courseId ?? { not: null },
    },
  });

  const matches = goals.flatMap((goal) => {
    const sourceId = isJsonObject(goal.details) ? goal.details.courseStartSourceId : null;
    const courseId = goal.primaryCourseId;
    const { skills, optionSkills = [] } = parsePlanGraph(goal.plan?.graph);

    const courseIds = new Set(
      [...skills, ...optionSkills].flatMap((skill) => skill.courseIds ?? []),
    );

    return typeof sourceId === "string" &&
      isUuid(sourceId) &&
      courseId &&
      courseIds.size === 1 &&
      courseIds.has(courseId)
      ? [
          {
            courseId: sourceId,
            editionId: courseId,
            language: courseContentLanguage(goal.language),
          },
        ]
      : [];
  });

  const [first] = matches;

  return first &&
    matches.every((match) => match.courseId === first.courseId && match.language === first.language)
    ? first
    : null;
}

async function hasConflictingMember(tx: TransactionClient, { course, edition }: CourseEditionPair) {
  const familyId = course.familyId ?? edition.familyId;

  if (!familyId || (course.familyId && edition.familyId)) {
    return false;
  }

  await tx.$queryRaw`SELECT id FROM course_families WHERE id = ${familyId}::uuid FOR NO KEY UPDATE`;

  const languagesToJoin = new Set(
    [course, edition]
      .filter((row) => !row.familyId)
      .map((row) => courseContentLanguage(row.language)),
  );

  const members = await tx.course.findMany({ select: { language: true }, where: { familyId } });

  return members.some((member) => languagesToJoin.has(courseContentLanguage(member.language)));
}

/** Either the saved plan or publication can supply the last condition an edition was waiting for. */
export async function linkResolvedCourseEdition(target: LinkTarget): Promise<void> {
  const match = await findResolvedPair(target);

  if (!match) {
    return;
  }

  const ids = [match.courseId, match.editionId];

  const linked = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM courses WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR NO KEY UPDATE`;
    const pair = await readCourseEditionPair(tx, match);

    if (
      !pair ||
      getCourseEditionProblem(pair) ||
      courseContentLanguage(pair.edition.language) !== match.language ||
      (await hasConflictingMember(tx, pair))
    ) {
      return false;
    }

    if (!(pair.course.familyId && pair.edition.familyId)) {
      await joinCourseEditionFamily(tx, pair);
    }

    return true;
  });

  if (linked) {
    await revalidateCourseContent(ids.map((id) => getCourseCacheTag(id)));
  }
}
