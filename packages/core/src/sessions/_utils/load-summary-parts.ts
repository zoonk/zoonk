import "server-only";
import { type MasteryState, type Milestone, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { pickCeremony } from "../../milestones/milestone-rules";
import { readBlockPayload } from "../block-payload";
import { capReviewDay } from "../capsules";
import { getLessonComesBack } from "./lesson-block";
import { loadPlanLessons } from "./load-plan-lessons";
import { type SessionAnswer, getDueItemIds } from "./session-answers";
import { type StudySessionRow } from "./study-session-access";

/** "9 cards come back on Friday": the session's skills by the day they're next due. */
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
  const skillIds = [
    ...new Set(answers.flatMap((answer) => (answer.skillId ? [answer.skillId] : []))),
  ];

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

/** Each lesson finished in the session, sealed as a capsule with its opening date. */
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

/**
 * What the buddy ate this session: new ideas (cards that left New), reviews (capsule answers) and
 * fixes (mistakes fixed since the session started).
 */
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

/** The one ceremony this session may show: the most important milestone not shown yet. */
export async function loadCeremony(userId: string): Promise<Milestone | null> {
  const unshown = await prisma.milestone.findMany({ where: { shownAt: null, userId } });
  return pickCeremony(unshown);
}

/**
 * "Tomorrow: Linear functions": the next lesson the plan has for the goal, by the title Today and
 * the session show for it (a chapter's next lesson, not the chapter's outline title).
 */
export async function loadTomorrow({
  goalId,
  userId,
}: {
  goalId: string | null;
  userId: string;
}): Promise<{ title: string } | null> {
  if (!goalId) {
    return null;
  }

  const next = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    where: { kind: { in: ["lesson", "chapter"] }, plan: { goalId }, status: "todo" },
  });

  if (!next) {
    return null;
  }

  const [lesson] = await loadPlanLessons({ items: [next], userId });
  return { title: lesson?.title ?? next.titleSnapshot };
}
