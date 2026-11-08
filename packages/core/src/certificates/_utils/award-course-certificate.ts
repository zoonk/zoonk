import "server-only";
import { issueEarnedCertificates } from "@zoonk/auth/certificate-issuance";
import { type Goal, type PlanItem, type Sql, type TransactionClient, sql } from "@zoonk/db";
import { isValidCategory } from "@zoonk/utils/categories";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { countLessons } from "../../plans/_utils/stand-in-lessons";
import { getWorkProgress, isWorkFinished } from "../../plans/_utils/work-progress";
import { LEARN_KINDS, PHASE_WORK_KINDS } from "../../plans/planner/plan-item-rules";
import { parsePlanPhases } from "../../plans/planner/plan-state";
import { type CourseCertificateDetails } from "../certificate-contract";
import { createCertificateCode } from "./certificate-code";
import { COURSE_GOALS, type CertificateUnit } from "./certificate-units";
import {
  UNIT_PLAN_SELECT,
  type UnitGoal,
  type UnitPlan,
  loadCertificateUnits,
} from "./load-certificate-units";

type CertificateGoal = UnitGoal & Pick<Goal, "language" | "timezone">;

const GOAL_SELECT = {
  details: true,
  examBlueprintId: true,
  id: true,
  kind: true,
  language: true,
  primaryCourseId: true,
  targetDate: true,
  timezone: true,
  userId: true,
} as const;

/** Unknown when any studied lesson has no estimate (legacy items), rather than undercounted. */
export function sumStudiedMinutes(studied: readonly Pick<PlanItem, "minutes">[]): number | null {
  const minutes = studied.map((item) => item.minutes);

  if (minutes.includes(null)) {
    return null;
  }

  return Math.round(minutes.reduce((sum: number, value) => sum + (value ?? 0), 0));
}

/** The unit's last finished work dates it, so a later claim keeps that day. */
export function getLastFinishedAt(
  items: readonly Pick<PlanItem, "completedAt" | "status">[],
): Date {
  const times = items.flatMap((item) =>
    isWorkFinished(item.status) && item.completedAt ? item.completedAt.getTime() : [],
  );

  return times.length > 0 ? new Date(Math.max(...times)) : new Date();
}

async function loadChapters(tx: TransactionClient, units: readonly CertificateUnit[]) {
  const chapters = await tx.chapter.findMany({
    select: { id: true, title: true },
    where: { id: { in: [...new Set(units.flatMap((unit) => unit.chapterIds))] } },
  });

  return new Map(chapters.map((chapter) => [chapter.id, chapter]));
}

type UnitChapters = Awaited<ReturnType<typeof loadChapters>>;

function listTopics({
  chapters,
  plan,
  unit,
}: {
  chapters: UnitChapters;
  plan: UnitPlan;
  unit: CertificateUnit;
}): string[] {
  if (unit.chapterIds.length > 0) {
    return unit.chapterIds.flatMap((id) => chapters.get(id)?.title ?? []);
  }

  const phases = new Set(unit.items.map((item) => item.phase));

  return parsePlanPhases(plan.phases).flatMap((phase, index) =>
    phases.has(index) ? phase.name : [],
  );
}

function buildDetails({
  category,
  topics,
  unit,
}: {
  category: string | null;
  topics: string[];
  unit: CertificateUnit;
}): CourseCertificateDetails {
  const lessons = unit.items.filter((item) => item.kind === "lesson");
  const studied = lessons.filter((item) => getWorkProgress(item.status) === "studied");

  return {
    category: isValidCategory(category) ? category : null,
    lessonsStudied: countLessons(studied),
    lessonsTestedOut: countLessons(
      lessons.filter((item) => getWorkProgress(item.status) === "testedOut"),
    ),
    minutes: sumStudiedMinutes(studied),
    topics,
  };
}

/**
 * Writes a certificate for each of the plan's finished units the learner doesn't hold yet, and
 * returns every unit with the learner's certificate keys. Callers hold the learner's lock, so two
 * finishes of one unit write it once; the unique key backs that up.
 */
export async function writeFinishedUnits(
  tx: TransactionClient,
  { goal, plan }: { goal: CertificateGoal; plan: UnitPlan },
) {
  const loaded = await loadCertificateUnits({ goal, plan }, tx);
  const { due } = loaded;

  if (due.length === 0) {
    return { ...loaded, written: 0 };
  }

  const [chapters, category] = await Promise.all([
    loadChapters(tx, due),
    goal.primaryCourseId
      ? tx.courseCategory.findFirst({
          orderBy: { createdAt: "asc" },
          select: { category: true },
          where: { courseId: goal.primaryCourseId },
        })
      : null,
  ]);

  const timeZone = getAnswerTimeZone({ goal });

  const rows = due.map((unit) => ({
    code: createCertificateCode(),
    completedOn: getDateInTimeZone({ date: getLastFinishedAt(unit.items), timeZone }),
    courseId: goal.primaryCourseId,
    courseLevel: unit.courseLevel,
    details: buildDetails({
      category: category?.category ?? null,
      topics: listTopics({ chapters, plan, unit }),
      unit,
    }),
    goalId: goal.id,
    key: unit.key,
    kind: "course" as const,
    language: goal.language,
    title: unit.title,
    userId: goal.userId,
  }));

  await tx.certificate.createMany({ data: rows });
  await issueEarnedCertificates(tx, { now: new Date(), plus: "check", userId: goal.userId });

  return { ...loaded, written: rows.length };
}

export function loadCertificatePlan(
  tx: TransactionClient,
  where: { goalId: string } | { id: string },
) {
  return tx.plan.findUnique({
    select: { ...UNIT_PLAN_SELECT, goal: { select: GOAL_SELECT } },
    where,
  });
}

/** The chapter counts in the level of the finished item's primary course. */
function isAtLevel(chapterId: Sql) {
  return sql`EXISTS (
    SELECT 1 FROM course_chapters
    WHERE course_id = done.course_id AND chapter_id = ${chapterId} AND level = levels.level
  )`;
}

/** One of the skills is taught at the level: its chapters' lessons teach it, or it's its own level. */
function isTaughtAtLevel(skillIds: Sql) {
  return sql`(
    EXISTS (
      SELECT 1 FROM course_chapters at_level
      JOIN chapter_lessons placed ON placed.chapter_id = at_level.chapter_id
      JOIN lesson_skills taught ON taught.lesson_id = placed.lesson_id
      WHERE at_level.course_id = done.course_id AND at_level.level = levels.level
        AND taught.skill_id IN (${skillIds})
    )
    OR EXISTS (SELECT 1 FROM skills WHERE level = levels.level AND id IN (${skillIds}))
  )`;
}

/**
 * The plans where an item finished in a phase with work left can finish a level a closed phase
 * holds: a level the learner doesn't hold yet that the item counts in or teaches a skill of. It
 * reads a skill at every level teaching it and at its own, wider than the units do, so it only
 * skips plans where no level can change.
 */
async function findPlansLaterLessonsCanCertify(
  tx: TransactionClient,
  { closed, itemIds }: { closed: readonly { phase: number; planId: string }[]; itemIds: string[] },
): Promise<string[]> {
  if (itemIds.length === 0) {
    return [];
  }

  const rows = await tx.$queryRaw<{ planId: string }[]>`
    WITH done AS (
      SELECT item.plan_id, item.lesson_id, item.skill_id, goal.user_id,
        goal.primary_course_id AS course_id,
        COALESCE(item.chapter_id, lesson.home_chapter_id) AS chapter_id
      FROM plan_items item
      JOIN plans plan ON plan.id = item.plan_id
      JOIN goals goal ON goal.id = plan.goal_id
      JOIN courses course ON course.id = goal.primary_course_id
      LEFT JOIN library_lessons lesson ON lesson.id = item.lesson_id
      WHERE item.id = ANY(${itemIds}::uuid[])
        AND goal.kind::text = ANY(${[...COURSE_GOALS]}::text[])
        AND course.format = 'core' AND course.visibility = 'public'
    ),
    closed AS (
      SELECT item.plan_id, item.lesson_id, item.skill_id,
        COALESCE(item.chapter_id, lesson.home_chapter_id) AS chapter_id
      FROM unnest(
        ${closed.map((phase) => phase.planId)}::uuid[],
        ${closed.map((phase) => phase.phase)}::int[]
      ) AS closed_phase(plan_id, phase)
      JOIN plan_items item ON item.plan_id = closed_phase.plan_id AND item.phase = closed_phase.phase
      LEFT JOIN library_lessons lesson ON lesson.id = item.lesson_id
      WHERE item.kind::text = ANY(${[...LEARN_KINDS]}::text[])
    )
    SELECT DISTINCT done.plan_id AS "planId"
    FROM done
    CROSS JOIN LATERAL (
      SELECT DISTINCT level FROM course_chapters WHERE course_id = done.course_id
    ) levels
    WHERE NOT EXISTS (
        SELECT 1 FROM certificates
        WHERE user_id = done.user_id AND kind = 'course'
          AND key = done.course_id::text || ':' || levels.level::text
      )
      AND EXISTS (
        SELECT 1 FROM closed
        WHERE closed.plan_id = done.plan_id
          AND (
            ${isAtLevel(sql`closed.chapter_id`)}
            OR (
              closed.lesson_id IS NULL AND closed.chapter_id IS NULL
              AND ${isTaughtAtLevel(sql`SELECT closed.skill_id`)}
            )
          )
      )
      AND (
        ${isAtLevel(sql`done.chapter_id`)}
        OR ${isTaughtAtLevel(
          sql`SELECT done.skill_id UNION SELECT skill_id FROM lesson_skills WHERE lesson_id = done.lesson_id`,
        )}
      )`;

  return rows.map((row) => row.planId);
}

/**
 * A unit finishes with its own phase's last work, or with a lesson from another phase once one of
 * its phases closed, so a plan where neither can happen is skipped before its scope is read.
 */
export async function awardCourseCertificates(
  tx: TransactionClient,
  { finished }: { finished: readonly Pick<PlanItem, "id" | "kind" | "phase" | "planId">[] },
): Promise<void> {
  const work = finished.filter((item) => PHASE_WORK_KINDS.has(item.kind));

  if (work.length === 0) {
    return;
  }

  const progress = await tx.planItem.groupBy({
    by: ["planId", "phase", "status"],
    where: {
      kind: { in: [...PHASE_WORK_KINDS] },
      planId: { in: [...new Set(work.map((item) => item.planId))] },
    },
  });

  const left = new Set(
    progress.flatMap((row) => (row.status === "todo" ? `${row.planId}:${row.phase}` : [])),
  );

  const closed = progress.filter((row) => !left.has(`${row.planId}:${row.phase}`));
  const closedPlans = new Set(closed.map((row) => row.planId));
  const isClosed = (item: (typeof work)[number]) => !left.has(`${item.planId}:${item.phase}`);
  const finishing = new Set(work.flatMap((item) => (isClosed(item) ? item.planId : [])));

  const later = await findPlansLaterLessonsCanCertify(tx, {
    closed,
    itemIds: work.flatMap((item) =>
      item.kind === "lesson" && closedPlans.has(item.planId) && !finishing.has(item.planId)
        ? item.id
        : [],
    ),
  });

  for (const id of new Set([...finishing, ...later])) {
    // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
    const plan = await loadCertificatePlan(tx, { id });

    if (plan && COURSE_GOALS.has(plan.goal.kind)) {
      // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
      await writeFinishedUnits(tx, { goal: plan.goal, plan });
    }
  }
}
