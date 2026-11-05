import "server-only";
import { issueEarnedCertificates } from "@zoonk/auth/certificate-issuance";
import { type Goal, type PlanItem, type TransactionClient } from "@zoonk/db";
import { isValidCategory } from "@zoonk/utils/categories";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { countLessons } from "../../plans/_utils/stand-in-lessons";
import { getWorkProgress, isWorkFinished } from "../../plans/_utils/work-progress";
import { PHASE_WORK_KINDS } from "../../plans/planner/plan-item-rules";
import { parsePlanPhases } from "../../plans/planner/plan-state";
import { type CourseCertificateDetails } from "../certificate-contract";
import { createCertificateCode } from "./certificate-code";
import { type CertifiableItem, type CertificateUnit } from "./certificate-units";
import {
  UNIT_PLAN_SELECT,
  type UnitCourse,
  type UnitGoal,
  type UnitPlan,
  loadCertificateUnits,
} from "./load-certificate-units";

type CertificateGoal = UnitGoal & Pick<Goal, "language" | "timezone">;

const GOAL_SELECT = {
  id: true,
  kind: true,
  language: true,
  primaryCourseId: true,
  targetDate: true,
  timezone: true,
  userId: true,
} as const;

/** Unknown when any studied lesson has no estimate (legacy items), rather than undercounted. */
function sumStudiedMinutes(studied: readonly CertifiableItem[]): number | null {
  const minutes = studied.map((item) => item.minutes);

  if (minutes.includes(null)) {
    return null;
  }

  return Math.round(minutes.reduce((sum: number, value) => sum + (value ?? 0), 0));
}

/** The unit's last finished work dates it, so a later claim keeps that day. */
function getLastFinishedAt(items: readonly CertifiableItem[]): Date {
  const times = items.flatMap((item) =>
    isWorkFinished(item.status) && item.completedAt ? item.completedAt.getTime() : [],
  );

  return times.length > 0 ? new Date(Math.max(...times)) : new Date();
}

async function loadChapters(tx: TransactionClient, units: readonly CertificateUnit[]) {
  const chapters = await tx.chapter.findMany({
    select: { homeCourse: { select: { title: true } }, id: true, title: true },
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

/**
 * Named by a course, never by the goal's title, which the learner can rename: the primary course,
 * or for a plan without one, the course its first chapter was written for.
 */
function getCertificateTitle({
  chapters,
  course,
  unit,
}: {
  chapters: UnitChapters;
  course: UnitCourse | null;
  unit: CertificateUnit;
}): string | null {
  if (course) {
    return course.title;
  }

  const first = unit.chapterIds
    .map((id) => chapters.get(id))
    .find((chapter) => chapter?.homeCourse);

  return first?.homeCourse?.title ?? null;
}

function buildDetails({
  course,
  topics,
  unit,
}: {
  course: UnitCourse | null;
  topics: string[];
  unit: CertificateUnit;
}): CourseCertificateDetails {
  const lessons = unit.items.filter((item) => item.kind === "lesson");
  const studied = lessons.filter((item) => getWorkProgress(item.status) === "studied");
  const category = course?.categories[0]?.category ?? null;

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
  const held = new Set(loaded.held.map((row) => row.key));
  const due = loaded.units.filter((unit) => unit.finished && !held.has(unit.key));

  if (due.length === 0) {
    return { ...loaded, written: 0 };
  }

  const chapters = await loadChapters(tx, due);
  const timeZone = getAnswerTimeZone({ goal });

  const rows = due.flatMap((unit) => {
    const title = getCertificateTitle({ chapters, course: loaded.course, unit });

    if (!title) {
      return [];
    }

    const topics = listTopics({ chapters, plan, unit });

    return [
      {
        code: createCertificateCode(),
        completedOn: getDateInTimeZone({ date: getLastFinishedAt(unit.items), timeZone }),
        courseId: goal.primaryCourseId,
        courseLevel: unit.courseLevel,
        details: buildDetails({ course: loaded.course, topics, unit }),
        goalId: goal.id,
        key: unit.key,
        kind: "course" as const,
        language: goal.language,
        title,
        userId: goal.userId,
      },
    ];
  });

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

/**
 * A unit can only finish with the phase of the work that just finished, so a phase with lessons or
 * a challenge left skips its plan before the plan is read.
 */
export async function awardCourseCertificates(
  tx: TransactionClient,
  { finished }: { finished: readonly Pick<PlanItem, "kind" | "phase" | "planId">[] },
): Promise<void> {
  const work = finished.filter((item) => PHASE_WORK_KINDS.has(item.kind));

  if (work.length === 0) {
    return;
  }

  const open = await tx.planItem.groupBy({
    by: ["planId", "phase"],
    where: {
      OR: work.map(({ phase, planId }) => ({ phase, planId })),
      kind: { in: [...PHASE_WORK_KINDS] },
      status: "todo",
    },
  });

  const left = new Set(open.map((row) => `${row.planId}:${row.phase}`));

  const planIds = new Set(
    work.flatMap((item) => (left.has(`${item.planId}:${item.phase}`) ? [] : item.planId)),
  );

  for (const id of planIds) {
    // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
    const plan = await loadCertificatePlan(tx, { id });

    if (plan) {
      // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
      await writeFinishedUnits(tx, { goal: plan.goal, plan });
    }
  }
}
