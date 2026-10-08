import "server-only";
import { type ItemFormat, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { readNoticeFormats } from "../../../library/exams/notice-formats";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../../library/exams/true-false-labels";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type PlacementEvidence, getPlacementBeliefs } from "../placement-beliefs";
import { isPlacementBudgetUsed } from "../placement-budget";
import { type PlacementStatus, getKnownSubjects, getOwnLevel } from "../placement-contract";
import { getTargetDifficulty } from "../placement-difficulty";
import { type PlacementItemCandidate, pickPlacementItem } from "../placement-item-choice";
import { isOwnMaterialTest } from "../placement-material";
import { type PlacementQuickFormat, getPlacementQuickFormat } from "../placement-quick-format";
import {
  type AreaStart,
  type OwnLevel,
  type PhaseStart,
  getAreaStarts,
  getPhaseStarts,
  getSkillPlacementStatus,
  getUndecidedSkills,
  isPlacementSettled,
} from "../placement-steps";
import { chooseNextSkill } from "./next-placement-skill";
import { hasPlacementStarted, isPlacementAnswerOn } from "./placement-answers";
import { loadPlacementItems } from "./placement-bank-items";
import {
  type PlacementQuestionView,
  parsePlacementItem,
  toPlacementQuestionView,
} from "./placement-items";
import { loadPlanBuild } from "./placement-plan-build";

/**
 * Where placement stands for a goal: each phase's and each area's starting point, whether every
 * one is settled, the next question (null when there's none to ask now) and the skills that
 * still need questions made before placement can settle them.
 */
export type PlacementState = {
  answered: number;
  areas: AreaStart[];
  /** Every area of every phase has a confident start. False while the plan has no skills yet. */
  complete: boolean;
  /**
   * Today's few minutes of placement are used: it stops for the day with what it knows, and the
   * first week's sessions ask the rest a few at a time.
   */
  dayBudgetUsed: boolean;
  knownSkillIds: string[];
  needsItems: string[];
  next: PlacementQuestionView | null;
  phases: PhaseStart[];
  /**
   * This goal's placement already has answers (placement questions answered since the goal was
   * created), so a client coming back resumes at `next` instead of showing placement's start.
   */
  started: boolean;
  /** What the client does next (`placementStatusSchema`). */
  status: PlacementStatus;
  /** The words the goal's true-or-false questions are answered with. */
  trueFalseLabels: TrueFalseLabels;
};

/** Most skills need one or two questions: more than 1000 answers on one goal's skills is noise. */
const MAX_EVIDENCE = 1000;

type AttemptRow = {
  answer: unknown;
  answeredAt: Date;
  durationMs: number;
  isCorrect: boolean;
  item: { format: ItemFormat } | null;
  itemId: string | null;
  localDate: Date;
  skillId: string | null;
  stepId: string | null;
  studySessionId: string | null;
};

function getOutcome(attempt: AttemptRow): PlacementEvidence["outcome"] {
  if (attempt.isCorrect) {
    return "correct";
  }

  return isJsonObject(attempt.answer) && attempt.answer.dontKnow === true ? "dontKnow" : "wrong";
}

function toEvidence(attempt: AttemptRow): PlacementEvidence | null {
  if (!attempt.skillId) {
    return null;
  }

  return {
    // Lesson screens aren't bank items; their questions are about as guessable as multiple choice.
    format: attempt.item?.format ?? "multipleChoice",
    outcome: getOutcome(attempt),
    skillId: attempt.skillId,
  };
}

export async function loadEvidence({ skillIds, userId }: { skillIds: string[]; userId: string }) {
  const attempts = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: {
      answer: true,
      answeredAt: true,
      durationMs: true,
      isCorrect: true,
      item: { select: { format: true } },
      itemId: true,
      localDate: true,
      skillId: true,
      stepId: true,
      studySessionId: true,
    },
    take: MAX_EVIDENCE,
    where: { skillId: { in: skillIds }, userId },
  });

  const chronological = attempts.toReversed();

  return {
    attempts: chronological,
    evidence: chronological.map((attempt) => toEvidence(attempt)).filter((item) => item !== null),
    seenItemIds: new Set(chronological.map((attempt) => attempt.itemId)),
  };
}

/**
 * The goal's exam, whose questions placement may ask, how placement asks quickly for it, and the
 * words its statements are answered with.
 */
async function loadGoalExam(goalId: string): Promise<{
  /** A test from the learner's own material: only answered topics are settled (`answeredOnly`). */
  answeredOnly: boolean;
  examBlueprintId: string | null;
  goalCreatedAt: Date | null;
  /** The level the learner gave for the goal, stored on it. */
  goalLevel: OwnLevel | null;
  /** The exam's subjects the learner said they know well. */
  knownAreas: string[];
  quickFormat: PlacementQuickFormat;
  trueFalseLabels: TrueFalseLabels;
}> {
  const goal = await prisma.goal.findUnique({
    select: { createdAt: true, details: true, examBlueprint: true },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint ?? null;
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;
  const notice = readNoticeFormats(goal?.details);

  return {
    answeredOnly: isOwnMaterialTest(blueprint),
    examBlueprintId: blueprint?.id ?? null,
    goalCreatedAt: goal?.createdAt ?? null,
    goalLevel: goal ? getOwnLevel({ goal }) : null,
    knownAreas: goal ? getKnownSubjects(goal) : [],
    // Before the notice's blueprint is linked, the formats a first pass over it read.
    quickFormat: getPlacementQuickFormat(structure ?? notice),
    trueFalseLabels: getTrueFalseLabels(structure ?? notice),
  };
}

async function loadQuestion(itemId: string | undefined): Promise<PlacementQuestionView | null> {
  if (!itemId) {
    return null;
  }

  const item = await prisma.item.findUnique({ include: ITEM_IMAGE_INCLUDE, where: { id: itemId } });
  const parsed = item ? parsePlacementItem(item) : null;

  return parsed ? toPlacementQuestionView(parsed) : null;
}

/**
 * What the client does next. Without skills, placement waits for the plan, or stops when the run
 * building it gave up (`failed`). With nothing to ask while the day's budget is left and nothing is
 * settled: the question it asks next is still being written (`waitingForQuestions`), or none could
 * be written and none were answered (`unavailable`), so the learner goes on without placement.
 */
function getStatus({
  answered,
  buildFailed,
  complete,
  dayBudgetUsed,
  hasNext,
  hasSkills,
  waitsForQuestions,
}: {
  answered: number;
  buildFailed: boolean;
  complete: boolean;
  dayBudgetUsed: boolean;
  hasNext: boolean;
  hasSkills: boolean;
  waitsForQuestions: boolean;
}): PlacementStatus {
  if (!hasSkills) {
    return buildFailed ? "failed" : "preparing";
  }

  if (hasNext) {
    return "asking";
  }

  if (complete || dayBudgetUsed) {
    return "done";
  }

  if (waitsForQuestions) {
    return "waitingForQuestions";
  }

  return answered === 0 ? "unavailable" : "done";
}

/**
 * Computes placement from the learner's answers on the goal's skills. Every answer counts, placement
 * or not, so placement never really ends: lessons and reviews keep sharpening the same picture.
 * With `today` (the learner-local day), it stops asking once that day's few minutes are used.
 */
export async function loadPlacementState({
  goalId,
  ownLevel: requestedLevel,
  plan,
  today = null,
  userId,
}: {
  goalId: string;
  /** A level the request gave; the one stored on the goal otherwise. */
  ownLevel?: OwnLevel | null;
  plan: GoalPlan;
  today?: Date | null;
  userId: string;
}): Promise<PlacementState> {
  const skills = plan.skills;
  const skillIds = skills.map((skill) => skill.id);

  const {
    answeredOnly,
    examBlueprintId,
    goalCreatedAt,
    goalLevel,
    knownAreas,
    quickFormat,
    trueFalseLabels,
  } = await loadGoalExam(goalId);

  const ownLevel = requestedLevel ?? goalLevel;

  const [{ attempts, evidence, seenItemIds }, { bankItems, build }] = await Promise.all([
    loadEvidence({ skillIds, userId }),
    loadPlanBuild({ everySkill: answeredOnly, goalId, knownAreas }).then(async (planBuild) => ({
      bankItems: await loadPlacementItems({
        examBlueprintId,
        skillIds,
        writingSkillIds: planBuild.preparingSkillIds,
      }),
      build: planBuild,
    })),
  ]);

  const items: PlacementItemCandidate[] = bankItems.map((item) => ({
    ...item,
    seen: seenItemIds.has(item.id),
  }));

  // A test from the learner's own material asks every topic placement has (or will have) a
  // question for.
  const topics = answeredOnly
    ? new Set([...items.map((item) => item.skillId), ...build.preparingSkillIds]).size
    : 0;

  const dayBudgetUsed =
    today !== null &&
    isPlacementBudgetUsed({
      answers: attempts.filter((attempt) => isPlacementAnswerOn({ attempt, day: today })),
      topics,
    });

  const beliefs = getPlacementBeliefs({ answeredOnly, evidence, knownAreas, ownLevel, skills });
  const complete = isPlacementSettled({ answeredOnly, beliefs, skills });
  const askableSkillIds = new Set(items.filter((item) => !item.seen).map((item) => item.skillId));

  const needsItems = getUndecidedSkills({ answeredOnly, beliefs, skills })
    .filter((skill) => !askableSkillIds.has(skill.id))
    .map((skill) => skill.id);

  const nextSkillId = chooseNextSkill({
    askableSkillIds,
    choice: { answeredOnly, beliefs, evidence, ownLevel, skills },
    preparingSkillIds: build.preparingSkillIds,
    quickSkillIds: new Set(
      items.filter((item) => !item.seen && item.format === quickFormat).map((item) => item.skillId),
    ),
  });

  const waitsForNext = nextSkillId !== null && !askableSkillIds.has(nextSkillId);

  const nextItem =
    nextSkillId && !waitsForNext
      ? pickPlacementItem({
          confirming: evidence.some(
            (answer) => answer.skillId === nextSkillId && answer.outcome === "correct",
          ),
          items,
          quickFormat,
          skillId: nextSkillId,
          targetDifficulty: getTargetDifficulty({
            evidence,
            ownLevel,
            skillId: nextSkillId,
            skills,
          }),
        })
      : null;

  const next = dayBudgetUsed ? null : await loadQuestion(nextItem?.id);

  return {
    answered: evidence.length,
    areas: getAreaStarts({ beliefs, skills }),
    complete,
    dayBudgetUsed,
    knownSkillIds: skillIds.filter(
      (skillId) => getSkillPlacementStatus(beliefs.get(skillId)) === "known",
    ),
    needsItems,
    next,
    phases: getPhaseStarts({ beliefs, skills }),
    started: hasPlacementStarted({ attempts, since: goalCreatedAt }),
    status: getStatus({
      answered: evidence.length,
      buildFailed: build.failed,
      complete,
      dayBudgetUsed,
      hasNext: next !== null,
      hasSkills: skills.length > 0,
      waitsForQuestions: waitsForNext,
    }),
    trueFalseLabels,
  };
}
