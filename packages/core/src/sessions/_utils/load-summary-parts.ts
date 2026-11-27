import "server-only";
import { type MasteryState, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import {
  loadAnswersReviewSkillIds,
  loadLessonReviewSkillIds,
} from "../../learner/_utils/lesson-plan-skills";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { readBlockPayload } from "../block-payload";
import { capReviewDay, getCapsuleOpening } from "../capsules";
import { isExamTomorrow } from "./exam-tomorrow";
import { loadPlanLessons } from "./load-plan-lessons";
import { type SessionAnswer, getDueItemIds } from "./session-answers";
import { type StudySessionRow } from "./study-session-access";

const COMES_BACK_DAYS = 2;

export type SkillMove = { from: MasteryState; name: string; skillId: string; to: MasteryState };

export async function loadSkillNames(skillIds: readonly string[]) {
  return prisma.skill.findMany({
    select: { description: true, id: true, name: true },
    where: { id: { in: [...skillIds] } },
  });
}

export async function loadComesBack({
  answers,
  session,
  timeZone,
  userId,
}: {
  answers: readonly SessionAnswer[];
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}): Promise<{ date: Date; skills: number }[]> {
  const skillIds = await loadAnswersReviewSkillIds({ answers, userId });

  const rows = await prisma.learnerSkill.findMany({
    select: { due: true },
    where: { due: { not: null }, skillId: { in: skillIds }, userId },
  });

  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const targetDate = session.goal?.targetDate ?? null;

  const dates = rows.flatMap((row) => {
    const day = row.due
      ? capReviewDay({ day: getDateInTimeZone({ date: row.due, timeZone }), targetDate, today })
      : null;

    return day ? [day] : [];
  });

  const unique = [...new Set(dates.map((date) => date.getTime()))].toSorted((a, b) => a - b);

  return unique
    .slice(0, COMES_BACK_DAYS)
    .map((time) => ({
      date: new Date(time),
      skills: dates.filter((date) => date.getTime() === time).length,
    }));
}

/** Returns learner-local opening date labels for completed lessons, never later than the goal's date. */
export async function loadSealedCapsules({
  session,
  timeZone,
  userId,
}: {
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}): Promise<{ lessonId: string; opensOn: Date | null; title: string | null }[]> {
  const lessons = session.blocks.flatMap((block) =>
    block.kind === "learn" && block.status === "completed" && block.lessonId
      ? [{ block, lessonId: block.lessonId }]
      : [],
  );

  if (lessons.length === 0) {
    return [];
  }

  const skillIdsOf = await loadLessonReviewSkillIds({
    lessonIds: [...new Set(lessons.map((lesson) => lesson.lessonId))],
    userId,
  });

  const memories = await prisma.learnerSkill.findMany({
    select: { due: true, skillId: true },
    where: { skillId: { in: [...new Set([...skillIdsOf.values()].flat())] }, userId },
  });

  const dueOf = new Map(memories.map((memory) => [memory.skillId, memory.due]));
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const opensOn = (lessonId: string) => {
    const skillIds = skillIdsOf.get(lessonId) ?? [];

    const opening = getCapsuleOpening(
      skillIds.map((skillId) => ({ due: dueOf.get(skillId) ?? null })),
    );

    return opening
      ? capReviewDay({
          day: getDateInTimeZone({ date: opening, timeZone }),
          targetDate: session.goal?.targetDate ?? null,
          today,
        })
      : null;
  };

  return lessons.map(({ block, lessonId }) => ({
    lessonId,
    opensOn: opensOn(lessonId),
    title: readBlockPayload(block).title,
  }));
}

export async function loadBuddyMeal({
  answers,
  session,
  userId,
}: {
  answers: readonly SessionAnswer[];
  session: StudySessionRow;
  userId: string;
}) {
  const due = getDueItemIds(session.blocks.filter((block) => block.kind === "review"));

  const fixes = session.startedAt
    ? await prisma.mistake.count({
        where: { fixedAt: { gte: session.startedAt }, status: "fixed", userId },
      })
    : 0;

  return {
    fixes,
    reviews: answers.filter(
      (answer) => answer.isBlockAnswer && answer.itemId && due.has(answer.itemId),
    ).length,
  };
}

export async function loadTomorrow({
  session,
}: {
  session: Pick<StudySessionRow, "goal" | "goalId" | "localDate">;
}): Promise<{ title: string } | null> {
  const { goalId } = session;

  if (!goalId || isExamTomorrow({ day: session.localDate, goal: session.goal })) {
    return null;
  }

  const next = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    where: { kind: { in: [...LEARN_KINDS] }, plan: { goalId }, status: "todo" },
  });

  if (!next) {
    return null;
  }

  const [lesson] = await loadPlanLessons({ items: [next] });
  return { title: lesson?.title ?? next.titleSnapshot };
}
