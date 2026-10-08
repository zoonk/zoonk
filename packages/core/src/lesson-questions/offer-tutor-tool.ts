import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { isUuid } from "@zoonk/utils/uuid";
import { getAnytimeMockAccess } from "../exams/mocks/_utils/anytime-mock-access";
import {
  findRunningAnytimeMock,
  loadAnytimeMockSetup,
} from "../exams/mocks/_utils/anytime-mock-setup";
import { getSpeakingLevel } from "../language/conversations/_utils/conversation-goal";
import { loadPracticeCall } from "../language/conversations/_utils/practice-call";
import { loadDoneUnitIds } from "../language/units/can-do-events";
import { findCurrentUnit, loadLanguageUnits } from "../language/units/language-units";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { countSkippableItems, getChapterSkills } from "../learner/test-out/_utils/chapter-items";
import { getGoalPlan } from "../plans/get-goal-plan";
import { getSkillArea } from "../plans/planner/graph-areas";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getSession } from "../users/get-session";
import { findAnsweringQuestion } from "./_utils/answering-question";
import {
  offerEssay,
  offerMistakes,
  offerPlus,
  offerPronunciation,
  offerStartGoal,
} from "./_utils/feature-offers";
import { type TutorToolResult } from "./_utils/tutor-tool-result";
import { type TutorTool } from "./contract";

/** Fewer lessons to skip than this aren't worth a test: the learner just finishes them. */
const MIN_LESSONS_TO_SKIP = 2;

/** The plan's next lessons a chapter's test is looked for among. */
const NEXT_LESSONS = 200;

function sameArea(a: string, b: string): boolean {
  return normalizeString(a) === normalizeString(b);
}

/**
 * The chapters of the plan's next lessons, in the order they come (an area's own when one is
 * named), each once.
 */
async function listNextChapters({ area, goalId }: { area: string | null; goalId: string }) {
  const plan = await prisma.plan.findUnique({
    select: { graph: true, id: true },
    where: { goalId },
  });

  if (!plan) {
    return [];
  }

  const graph = parsePlanGraph(plan.graph);

  const areaSkillIds = area
    ? new Set(
        graph.skills
          .filter((skill) => sameArea(getSkillArea({ graph, skill }), area))
          .map((skill) => skill.skillId),
      )
    : null;

  const items = await prisma.planItem.findMany({
    orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
    select: { chapter: { select: { id: true, title: true } }, skillId: true },
    take: NEXT_LESSONS,
    where: { chapterId: { not: null }, kind: "lesson", planId: plan.id, status: "todo" },
  });

  const chapters = items.flatMap((item) =>
    item.chapter && (!areaSkillIds || (item.skillId && areaSkillIds.has(item.skillId)))
      ? [item.chapter]
      : [],
  );

  return chapters.filter(
    (chapter, index) => chapters.findIndex((other) => other.id === chapter.id) === index,
  );
}

/**
 * "Already know this? Take the test" for the chapter the plan (or the named area) goes to next,
 * when passing it would skip lessons: the first such chapter ahead.
 */
async function offerChapterTest({
  area,
  goalId,
}: {
  area: string | null;
  goalId: string;
}): Promise<TutorToolResult> {
  const [chapters, plan] = await Promise.all([
    listNextChapters({ area, goalId }),
    loadGoalPlan(goalId),
  ]);

  const offers = chapters.map((chapter) => {
    const skills = getChapterSkills({ chapterId: chapter.id, plan });
    return { chapter, lessonsLeft: skills.length > 0 ? countSkippableItems({ plan, skills }) : 0 };
  });

  const offer = offers.find((candidate) => candidate.lessonsLeft >= MIN_LESSONS_TO_SKIP);

  if (!offer) {
    return { reason: "nothingToSkip", status: "unavailable" };
  }

  return {
    offer: {
      chapterId: offer.chapter.id,
      chapterTitle: offer.chapter.title,
      goalId,
      kind: "chapterTest",
      lessonsLeft: offer.lessonsLeft,
    },
    status: "offered",
  };
}

/**
 * "Choose where to focus" (with the focus test first), offered where the plan offers it: its time
 * doesn't cover everything in depth and it has more than one subject.
 */
async function offerChooseFocus(goalId: string): Promise<TutorToolResult> {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    return { status: "notFound" };
  }

  const { feasibility, areas } = result.plan;
  const canChoose = Boolean(feasibility?.deadline && !feasibility.fits);

  return canChoose && areas.filter((candidate) => !candidate.skipped).length > 1
    ? { offer: { goalId, kind: "chooseFocus" }, status: "offered" }
    : { reason: "everythingFits", status: "unavailable" };
}

/** A practice call in the unit the learner is in, as the unit page offers it. */
async function offerConversationCall(goal: Goal): Promise<TutorToolResult> {
  if (goal.kind !== "language") {
    return { reason: "notLanguage", status: "unavailable" };
  }

  const units = await loadLanguageUnits(goal);
  const doneIds = await loadDoneUnitIds({ units, userId: goal.userId });
  const unit = findCurrentUnit({ doneIds, units });
  const { targetLanguage } = goal;

  if (!unit || !targetLanguage) {
    return { reason: "notLanguage", status: "unavailable" };
  }

  const level = await getSpeakingLevel({ goal, targetLanguage, userId: goal.userId });

  return {
    offer: {
      call: await loadPracticeCall({ chapterId: unit.chapterId, level }),
      chapterId: unit.chapterId,
      goalId: goal.id,
      kind: "conversationCall",
      unitTitle: unit.title,
    },
    status: "offered",
  };
}

/**
 * "Take a mock exam" for an exam goal, where the exam's pages offer it: only when a mock can be
 * built, so the button always opens one, and locked with what Plus unlocks when the learner's
 * plan doesn't include mock exams. The chooser continues the one they started, when there is one.
 */
async function offerMockExam(goal: Goal): Promise<TutorToolResult> {
  if (goal.kind !== "exam") {
    return { reason: "notExam", status: "unavailable" };
  }

  const [setup, access, running] = await Promise.all([
    loadAnytimeMockSetup(goal),
    getAnytimeMockAccess({ goal, timeZone: getAnswerTimeZone({ goal }) }),
    findRunningAnytimeMock({ goalId: goal.id, userId: goal.userId }),
  ]);

  if (!running && setup.options.length === 0) {
    return { reason: "noMock", status: "unavailable" };
  }

  return {
    offer: {
      access,
      goalId: goal.id,
      kind: "mockExam",
      subjects: setup.options.flatMap((option) => (option.kind === "area" ? option.areas : [])),
    },
    status: "offered",
  };
}

/** What a feature needs to open, besides the learner's goal. */
type OfferRequest = {
  /** For a chapter's test: the plan area whose next chapter to test, as the plan names it. */
  area: string | null;
  /** For a new goal: what the learner wants, in their words. */
  goalWords: string | null;
  tool: TutorTool;
  /** For a new goal: its subject in a few words, to look for a catalog course. */
  topic: string | null;
};

function resolveOffer({
  area,
  goal,
  goalWords,
  tool,
  topic,
}: OfferRequest & { goal: Goal }): Promise<TutorToolResult> {
  switch (tool) {
    case "startGoal":
      return offerStartGoal({ goal, topic, words: goalWords });
    case "chapterTest":
      return offerChapterTest({ area, goalId: goal.id });
    case "chooseFocus":
      return offerChooseFocus(goal.id);
    case "mockExam":
      return offerMockExam(goal);
    case "essay":
      return offerEssay(goal);
    case "mistakes":
      return offerMistakes(goal);
    case "conversationCall":
      return offerConversationCall(goal);
    case "pronunciation":
      return offerPronunciation(goal);
    case "stats":
    case "logbook":
    case "memory":
      return Promise.resolve({ offer: { kind: tool }, status: "offered" });
    case "plus":
      return offerPlus();
    default:
      return tool satisfies never;
  }
}

/**
 * The buddy offers one of the app's own features while it answers, whenever one answers what the
 * learner wants (`GOAL_TUTOR_APP_TOOLS` lists them): starting a new goal, a chapter's test for
 * lessons that feel too easy, choosing where the plan's depth goes, a mock exam, the exam's
 * written test, the mistakes notebook, a practice call or pronunciation in the language they're
 * learning, statistics, the week in review, memory or Plus. A feature the learner's plan doesn't
 * include comes locked, never hidden. The offer is saved with the answer, so the conversation
 * shows its card after a reload too; a feature that can't help now comes back `unavailable` with
 * why. Only the generation answering the learner's own question about one of their goals may
 * offer one.
 */
export async function offerTutorTool({
  area = null,
  goalWords = null,
  questionId,
  revision,
  tool,
  topic = null,
}: Partial<Omit<OfferRequest, "tool">> & {
  questionId: string;
  revision: number;
  tool: TutorTool;
}): Promise<TutorToolResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(questionId)) {
    return { status: "notFound" };
  }

  const question = await findAnsweringQuestion({ questionId, revision, userId: session.user.id });
  const goalId = question?.thread.goalId;
  const goal = goalId ? await prisma.goal.findUnique({ where: { id: goalId } }) : null;

  if (!goal) {
    return { status: "notFound" };
  }

  const result = await resolveOffer({ area: area?.trim() || null, goal, goalWords, tool, topic });

  if (result.status !== "offered") {
    return result;
  }

  const saved = await prisma.lessonQuestion.updateMany({
    data: { toolOffer: result.offer },
    where: { generationRevision: revision, id: questionId, status: "running" },
  });

  return saved.count > 0 ? result : { status: "notFound" };
}
