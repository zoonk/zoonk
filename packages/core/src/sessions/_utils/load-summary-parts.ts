import "server-only";
import { type MasteryState, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadAnswersReviewSkillIds } from "../../learner/_utils/lesson-plan-skills";
import { addDays } from "../../plans/planner/plan-calendar";
import { readBlockPayload } from "../block-payload";
import { capReviewDay } from "../capsules";
import { isExamTomorrow } from "./exam-tomorrow";
import { getLessonComesBack } from "./lesson-block";
import { loadPlanLessons } from "./load-plan-lessons";
import { loadExamPrepAccess } from "./plus-only-lessons";
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

/** Returns learner-local opening date labels for completed lessons. */
export async function loadSealedCapsules({
  session,
  timeZone,
  userId,
}: {
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}): Promise<{ lessonId: string; opensOn: Date | null; title: string | null }[]> {
  const lessons = session.blocks.filter(
    (block) => block.kind === "learn" && block.status === "completed" && block.lessonId,
  );

  return Promise.all(
    lessons.map(async (block) => ({
      lessonId: block.lessonId ?? "",
      opensOn: await getLessonComesBack({
        lessonId: block.lessonId,
        targetDate: session.goal?.targetDate ?? null,
        timeZone,
        userId,
      }),
      title: readBlockPayload(block).title,
    })),
  );
}

export async function loadBuddyMeal({
  answers,
  newIdeas,
  session,
  userId,
}: {
  answers: readonly SessionAnswer[];
  newIdeas: number;
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
    newIdeas,
    reviews: answers.filter((answer) => answer.itemId && due.has(answer.itemId)).length,
  };
}

/** Returns no next lesson on the exam eve or once tomorrow's free exam coverage ends. */
export async function loadTomorrow({
  session,
}: {
  session: Pick<StudySessionRow, "goal" | "goalId" | "localDate">;
}): Promise<{ title: string } | null> {
  const { goalId } = session;

  if (!goalId || isExamTomorrow({ day: session.localDate, goal: session.goal })) {
    return null;
  }

  const access = session.goal
    ? await loadExamPrepAccess({ goal: session.goal, today: addDays(session.localDate, 1) })
    : null;

  if (access?.trialEnded) {
    return null;
  }

  const next = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    where: { kind: { in: ["lesson", "chapter"] }, plan: { goalId }, status: "todo" },
  });

  if (!next) {
    return null;
  }

  const [lesson] = await loadPlanLessons({ items: [next] });
  return { title: lesson?.title ?? next.titleSnapshot };
}
