import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { searchCourses } from "../../courses/search-courses";
import { type Allowance } from "../../entitlements/contract";
import { getAllowance } from "../../entitlements/get-allowance";
import { loadDuePronunciation } from "../../language/pronunciation/load-due-pronunciation";
import { loadGoalSkillIds } from "../../learner/_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getExamPrepAccess } from "../../sessions/_utils/exam-access";
import { buildSyllabus } from "../../view-models/syllabus/_utils/build-syllabus";
import { loadSyllabusInput } from "../../view-models/syllabus/_utils/load-syllabus";
import { type TutorToolOffer } from "../contract";
import { type TutorOfferAccess, type TutorToolResult } from "./tutor-tool-result";

const MAX_GOAL_WORDS = 500;

/** Plus offers cannot unlock its own daily cap; leave that refusal to goal creation. */
function getStartGoalAccess(allowance: Allowance | null): TutorOfferAccess {
  if (!allowance || allowance.tier === "plus") {
    return "open";
  }

  const { limit, used } = allowance.activeGoals;
  const newGoalsLeft = allowance.items.find((item) => item.kind === "goal")?.remaining;
  const atGoalLimit = limit !== null && used >= limit;

  return atGoalLimit || newGoalsLeft === 0 ? "plusRequired" : "open";
}

async function findCatalogCourse({
  language,
  topic,
}: {
  language: string;
  topic: string | null;
}): Promise<Extract<TutorToolOffer, { kind: "startGoal" }>["course"]> {
  const [course] = topic
    ? await searchCourses({ filterByLanguage: true, language, limit: 1, query: topic })
    : [];

  if (!course) {
    return null;
  }

  return {
    brandSlug: course.organization.slug,
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl,
    slug: course.slug,
    title: course.title,
  };
}

/** Unavailable goal slots are shown locked, never hidden. */
export async function offerStartGoal({
  goal,
  topic,
  words,
}: {
  goal: Goal;
  topic: string | null;
  words: string | null;
}): Promise<TutorToolResult> {
  const filled = (words?.trim() || topic?.trim() || "").slice(0, MAX_GOAL_WORDS);

  if (!filled) {
    return { reason: "unavailable", status: "unavailable" };
  }

  const [allowance, course] = await Promise.all([
    getAllowance(),
    findCatalogCourse({ language: goal.language, topic: topic?.trim() || null }),
  ]);

  return {
    offer: { access: getStartGoalAccess(allowance), course, goal: filled, kind: "startGoal" },
    status: "offered",
  };
}

export async function offerEssay(goal: Goal): Promise<TutorToolResult> {
  const input = goal.kind === "exam" ? await loadSyllabusInput(goal) : null;
  const practice = input?.writtenPractice;

  const subject =
    input && practice
      ? buildSyllabus(input).subjects.find((candidate) =>
          candidate.areas.some((area) => practice.parts.includes(area)),
        )
      : null;

  if (!practice || !subject) {
    return { reason: goal.kind === "exam" ? "notWritten" : "notExam", status: "unavailable" };
  }

  const timeZone = getAnswerTimeZone({ goal });
  const allowance = await getAllowance();

  const access = getExamPrepAccess({
    examPrep: allowance?.examPrep ?? null,
    goal,
    timeZone,
    today: getDateInTimeZone({ date: new Date(), timeZone }),
  });

  return {
    offer: {
      access: access.trialEnded ? "plusRequired" : "open",
      cadence: practice.cadence,
      goalId: goal.id,
      kind: "essay",
      subject: subject.name,
      subjectKey: subject.key,
    },
    status: "offered",
  };
}

export async function offerMistakes(goal: Goal): Promise<TutorToolResult> {
  const skillIds = await loadGoalSkillIds(goal.id);

  const open = await prisma.mistake.count({
    where: { skillId: { in: skillIds }, status: "open", userId: goal.userId },
  });

  return open > 0
    ? { offer: { goalId: goal.id, kind: "mistakes", open }, status: "offered" }
    : { reason: "noMistakes", status: "unavailable" };
}

export async function offerPronunciation(goal: Goal): Promise<TutorToolResult> {
  if (goal.kind !== "language" || !goal.targetLanguage) {
    return { reason: "notLanguage", status: "unavailable" };
  }

  const due = await loadDuePronunciation({ language: goal.targetLanguage, userId: goal.userId });

  return due
    ? { offer: { ...due, goalId: goal.id, kind: "pronunciation" }, status: "offered" }
    : { reason: "nothingDue", status: "unavailable" };
}

export async function offerPlus(): Promise<TutorToolResult> {
  const allowance = await getAllowance();

  return { offer: { kind: "plus", subscribed: allowance?.tier === "plus" }, status: "offered" };
}
