import "server-only";
import { isDeepStrictEqual } from "node:util";
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
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { countSkippableItems, getChapterSkills } from "../learner/test-out/_utils/chapter-items";
import { loadBlockedTestOutChapters } from "../learner/test-out/_utils/offer-eligibility";
import { getGoalPlan } from "../plans/get-goal-plan";
import { getSkillArea } from "../plans/planner/graph-areas";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getSession } from "../users/get-session";
import { findAnsweringGoal } from "./_utils/answering-question";
import {
  offerEssay,
  offerMistakes,
  offerPlus,
  offerPronunciation,
  offerStartGoal,
} from "./_utils/feature-offers";
import { type TutorToolResult } from "./_utils/tutor-tool-result";
import { type TutorTool } from "./contract";

const MIN_LESSONS_TO_SKIP = 2;

const NEXT_LESSONS = 200;

function sameArea(a: string, b: string): boolean {
  return normalizeString(a) === normalizeString(b);
}

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

async function offerChapterTest({
  area,
  goal,
}: {
  area: string | null;
  goal: Goal;
}): Promise<TutorToolResult> {
  const goalId = goal.id;

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

  const blocked = await loadBlockedTestOutChapters({
    chapterIds: [offer.chapter.id],
    goalId,
    now: new Date(),
    timeZone: getAnswerTimeZone({ goal }),
    userId: goal.userId,
  });

  if (blocked.has(offer.chapter.id)) {
    return { reason: "testFailedToday", status: "unavailable" };
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

async function offerMockExam(goal: Goal): Promise<TutorToolResult> {
  if (goal.kind !== "exam") {
    return { reason: "notExam", status: "unavailable" };
  }

  const [setup, access, running] = await Promise.all([
    loadAnytimeMockSetup(goal),
    getAnytimeMockAccess(goal),
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
      return offerChapterTest({ area, goal });
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

/** Only the claimed answer generation may save offers for its question's goal. Unavailable features return a reason; locked ones stay visible. */
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

  const goal = await findAnsweringGoal({ questionId, revision, userId: session.user.id });

  if (!goal) {
    return { status: "notFound" };
  }

  const result = await resolveOffer({ area: area?.trim() || null, goal, goalWords, tool, topic });

  if (result.status !== "offered") {
    return result;
  }

  return writeLearnerChange<TutorToolResult>({ userId: session.user.id }, async (tx) => {
    const answering = await tx.lessonQuestion.findFirst({
      select: { toolOffer: true },
      where: { generationRevision: revision, id: questionId, status: "running" },
    });

    if (!answering) {
      return unchanged({ status: "notFound" });
    }

    if (isDeepStrictEqual(answering.toolOffer, result.offer)) {
      return unchanged(result);
    }

    await tx.lessonQuestion.update({
      data: { toolOffer: result.offer },
      where: { id: questionId },
    });

    return result;
  });
}
