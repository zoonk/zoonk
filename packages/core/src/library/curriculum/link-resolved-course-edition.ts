import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../../cache/tags";
import {
  courseContentLanguage,
  getCourseEditionProblem,
  joinCourseEditionFamily,
  readCourseEditionPair,
} from "../../courses/_utils/course-edition-family";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getContentCountryScope } from "../content-country";
import { getSinglePlanCourseId } from "./goal-plan-graph";

async function readOrigin(db: TransactionClient, editionId: string) {
  const goals = await db.goal.findMany({
    select: {
      contentCountry: true,
      language: true,
      plan: { select: { graph: true } },
      sourceCourse: { select: { country: true, id: true } },
    },
    where: { primaryCourseId: editionId, replacesGoalId: null, sourceCourseId: { not: null } },
  });

  const origin = goals[0]?.sourceCourse;

  if (!origin || !goals.every((goal) => goal.sourceCourse?.id === origin.id)) {
    return null;
  }

  const goal = goals.find((row) => {
    const graph = parsePlanGraph(row.plan?.graph);

    return (
      row.contentCountry === origin.country &&
      graph.editionCandidate &&
      getSinglePlanCourseId(graph) === editionId
    );
  });

  return goal
    ? { courseId: origin.id, editionId, language: courseContentLanguage(goal.language) }
    : null;
}

export async function linkResolvedCourseEdition({
  courseId: editionId,
}: {
  courseId: string;
}): Promise<void> {
  const source = await prisma.goal.findFirst({
    select: { sourceCourseId: true },
    where: { primaryCourseId: editionId, replacesGoalId: null, sourceCourseId: { not: null } },
  });

  if (!source?.sourceCourseId) {
    return;
  }

  const ids = [source.sourceCourseId, editionId];

  const linked = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM courses WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR NO KEY UPDATE`;
    const origin = await readOrigin(tx, editionId);

    if (!origin || origin.courseId !== source.sourceCourseId) {
      return false;
    }

    const pair = await readCourseEditionPair(tx, origin);

    if (
      !pair ||
      (pair.course.familyId !== null && pair.course.familyId === pair.edition.familyId) ||
      courseContentLanguage(pair.edition.language) !== origin.language ||
      getContentCountryScope({ country: pair.edition.country, language: pair.edition.language }) !==
        getContentCountryScope({ country: pair.course.country, language: pair.edition.language }) ||
      (await getCourseEditionProblem(tx, pair))
    ) {
      return false;
    }

    await joinCourseEditionFamily(tx, pair);
    return true;
  });

  if (linked) {
    await revalidateCourseContent([
      COURSE_LIST_CACHE_TAG,
      ...ids.map((id) => getCourseCacheTag(id)),
    ]);
  }
}
