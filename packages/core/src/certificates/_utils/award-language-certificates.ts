import "server-only";
import { issueEarnedCertificates } from "@zoonk/auth/certificate-issuance";
import { type PlanItem, type TransactionClient } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type PlanLevel, getUnitLevels, listPlanLevels } from "../../language/levels/plan-levels";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { countLessons } from "../../plans/_utils/stand-in-lessons";
import { type LanguageLevelCertificateDetails } from "../certificate-contract";
import { getLastFinishedAt, sumStudiedMinutes } from "./award-course-certificate";
import { createCertificateCode } from "./certificate-code";
import { loadGraphSkills } from "./graph-skills";

/**
 * Goals built from a learner's own material have a private course and earn no language levels.
 * Each read is its own query, so none overlaps another on the transaction's connection.
 */
async function loadLanguagePlans(tx: TransactionClient, planIds: readonly string[]) {
  const plans = await tx.plan.findMany({
    select: {
      goal: {
        select: { id: true, language: true, targetLanguage: true, timezone: true, userId: true },
      },
      graph: true,
      id: true,
    },
    where: {
      goal: { kind: "language", primaryCourse: { visibility: "public" } },
      id: { in: [...planIds] },
    },
  });

  if (plans.length === 0) {
    return [];
  }

  const items = await tx.planItem.findMany({
    orderBy: { position: "asc" },
    select: {
      chapterId: true,
      completedAt: true,
      kind: true,
      lessonId: true,
      lessons: true,
      minutes: true,
      planId: true,
      skillId: true,
      status: true,
    },
    where: { kind: "lesson", planId: { in: plans.map((plan) => plan.id) } },
  });

  const byPlan = Map.groupBy(items, (item) => item.planId);
  return plans.map((plan) => ({ ...plan, items: byPlan.get(plan.id) ?? [] }));
}

type LanguagePlan = Awaited<ReturnType<typeof loadLanguagePlans>>[number];

function getLevelKey({ language, level }: { language: string; level: CefrLevel }): string {
  return `${language}:${level}`;
}

async function loadPlanLevels(tx: TransactionClient, plan: LanguagePlan): Promise<PlanLevel[]> {
  const graphSkills = await loadGraphSkills(plan.graph, tx);

  const skillIds = new Set([
    ...graphSkills.map((skill) => skill.skillId),
    ...plan.items.flatMap((item) => item.skillId ?? []),
  ]);

  const skippedLessonIds = plan.items.flatMap((item) =>
    item.status === "skipped" && item.lessonId ? item.lessonId : [],
  );

  const skills = await tx.skill.findMany({
    select: { cefrLevel: true, id: true, level: true },
    where: { id: { in: [...skillIds] } },
  });

  const heldBack =
    skippedLessonIds.length > 0
      ? await tx.lesson.findMany({
          select: { id: true },
          where: { id: { in: skippedLessonIds }, setAsideAt: { not: null } },
        })
      : [];

  return listPlanLevels({
    graphSkills,
    heldBackLessonIds: new Set(heldBack.map((lesson) => lesson.id)),
    items: plan.items,
    skills: new Map(skills.map((skill) => [skill.id, skill])),
  });
}

async function loadCanDos(
  tx: TransactionClient,
  {
    due,
    levels,
    plan,
  }: { due: readonly PlanLevel[]; levels: readonly PlanLevel[]; plan: LanguagePlan },
): Promise<Map<CefrLevel, string[]>> {
  const unitLevels = getUnitLevels(levels);
  const dueLevels = new Set(due.map((entry) => entry.level));
  const unitIds = [...unitLevels].flatMap(([id, level]) => (dueLevels.has(level) ? id : []));

  const chapters = await tx.chapter.findMany({
    select: { id: true, objectives: true },
    where: { id: { in: unitIds } },
  });

  const objectives = new Map(chapters.map((chapter) => [chapter.id, chapter.objectives]));
  const ordered = [...new Set(plan.items.flatMap((item) => item.chapterId ?? []))];

  return new Map(
    due.map((entry) => [
      entry.level,
      ordered.flatMap((id) =>
        unitLevels.get(id) === entry.level ? (objectives.get(id) ?? []) : [],
      ),
    ]),
  );
}

function buildDetails({
  canDo,
  entry,
}: {
  canDo: string[];
  entry: PlanLevel;
}): LanguageLevelCertificateDetails {
  const studied = entry.items.filter((item) => item.status === "done");
  return { canDo, lessonsStudied: countLessons(studied), minutes: sumStudiedMinutes(studied) };
}

async function awardPlanLevels(tx: TransactionClient, plan: LanguagePlan): Promise<void> {
  const { goal } = plan;

  if (!goal.targetLanguage) {
    return;
  }

  const language = goal.targetLanguage;
  const levels = await loadPlanLevels(tx, plan);
  const earned = levels.filter((entry) => entry.earned);

  if (earned.length === 0) {
    return;
  }

  const held = await tx.certificate.findMany({
    select: { key: true },
    where: {
      key: { in: earned.map(({ level }) => getLevelKey({ language, level })) },
      kind: "languageLevel",
      userId: goal.userId,
    },
  });

  const heldKeys = new Set(held.map((row) => row.key));
  const due = earned.filter(({ level }) => !heldKeys.has(getLevelKey({ language, level })));

  if (due.length === 0) {
    return;
  }

  const canDos = await loadCanDos(tx, { due, levels, plan });
  const timeZone = getAnswerTimeZone({ goal });

  await tx.certificate.createMany({
    data: due.map((entry) => ({
      code: createCertificateCode(),
      completedOn: getDateInTimeZone({
        date: getLastFinishedAt(
          levels.slice(0, levels.indexOf(entry) + 1).flatMap((below) => below.items),
        ),
        timeZone,
      }),
      details: buildDetails({ canDo: canDos.get(entry.level) ?? [], entry }),
      goalId: goal.id,
      key: getLevelKey({ language, level: entry.level }),
      kind: "languageLevel" as const,
      language: goal.language,
      level: entry.level,
      targetLanguage: language,
      userId: goal.userId,
    })),
  });

  await issueEarnedCertificates(tx, { now: new Date(), plus: "check", userId: goal.userId });
}

/**
 * Awards each CEFR level a language plan with just-finished lessons has earned, once per language
 * and level, never revoked. It reads the whole plan rather than what just finished, so a level
 * finished before is awarded with the next lesson. Callers hold the learner's lock.
 */
export async function awardLanguageLevelCertificates(
  tx: TransactionClient,
  { finished }: { finished: readonly Pick<PlanItem, "kind" | "planId">[] },
): Promise<void> {
  const planIds = [
    ...new Set(finished.flatMap((item) => (item.kind === "lesson" ? item.planId : []))),
  ];

  if (planIds.length === 0) {
    return;
  }

  const plans = await loadLanguagePlans(tx, planIds);

  for (const plan of plans) {
    // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
    await awardPlanLevels(tx, plan);
  }
}
