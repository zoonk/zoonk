import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { toChosenStructure } from "../../../exams/choices/exam-choices";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readNoticeFormats } from "../../../library/exams/notice-formats";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../../library/exams/true-false-labels";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { getAreaShares } from "../../../plans/_utils/exam-subject-shares";
import { listFocusedSkillIds } from "../../../plans/planner/focus-targets";
import {
  type PlanGraph,
  type PlanSettings,
  parsePlanGraph,
  parsePlanSettings,
} from "../../../plans/planner/plan-state";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { type PlacementEvidence } from "../placement-beliefs";
import { getPlacementBudgetSpent } from "../placement-budget";
import {
  type PlacementStatus,
  getKnownSubjects,
  getOwnLevel,
  isLevelMeasured,
} from "../placement-contract";
import { getTargetDifficulty } from "../placement-difficulty";
import { type PlacementItemCandidate, pickPlacementItem } from "../placement-item-choice";
import { listKnownByMeasuredLevel, listKnownSkillIds, readSkillStatuses } from "../placement-known";
import { isOwnMaterialTest } from "../placement-material";
import { confirmsInWriting, getPlacementQuickFormat } from "../placement-quick-format";
import { type SkillStatuses } from "../placement-status";
import {
  type AreaStart,
  type OwnLevel,
  type PhaseStart,
  getAreaStarts,
  getPhaseStarts,
  getUndecidedSkills,
  isPlacementSettled,
} from "../placement-steps";
import { chooseNextSkill } from "./next-placement-skill";
import { countPlacementAnswers, isPlacementAnswerOn } from "./placement-answers";
import { loadPlacementItems } from "./placement-bank-items";
import { loadEvidence } from "./placement-evidence";
import {
  type PlacementQuestionView,
  parsePlacementItem,
  toPlacementQuestionView,
} from "./placement-items";
import { loadPlanBuild } from "./placement-plan-build";

export type PlacementState = {
  answered: number;
  areas: AreaStart[];
  /** False while the plan has no skills. */
  complete: boolean;
  /** Fraction from 0 to 1; placement can settle before it reaches one. */
  dayBudgetSpent: number;
  /** Unfinished placement continues in first-week sessions after today's budget is used. */
  dayBudgetUsed: boolean;
  knownSkillIds: string[];
  needsItems: string[];
  next: PlacementQuestionView | null;
  phases: PhaseStart[];
  /** Resume at next rather than showing the start screen. */
  started: boolean;
  status: PlacementStatus;
  trueFalseLabels: TrueFalseLabels;
};

function getChosenAreaShares({
  graph,
  settings,
  structure,
}: {
  graph: PlanGraph;
  settings: PlanSettings;
  structure: ExamStructure | null;
}): Map<string, number> | null {
  return structure
    ? getAreaShares({
        graph,
        structure: toChosenStructure({ choices: settings.examChoices, structure }),
      })
    : null;
}

async function loadGoalExam(goalId: string, tx: TransactionClient) {
  const goal = await tx.goal.findUnique({
    include: { examBlueprint: true, plan: { select: { graph: true, settings: true } } },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint ?? null;
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;
  const notice = readNoticeFormats(goal?.details);
  const graph = parsePlanGraph(goal?.plan?.graph);
  const settings = parsePlanSettings(goal?.plan?.settings);

  return {
    answeredOnly: isOwnMaterialTest(blueprint),
    areaShares: getChosenAreaShares({ graph, settings, structure }),
    examBlueprintId: blueprint?.id ?? null,
    focusAreas: settings.focusAreas,
    focusedSkillIds: listFocusedSkillIds({ graph, settings }),
    goalCreatedAt: goal?.createdAt ?? null,
    goalLevel: goal ? getOwnLevel({ goal }) : null,
    knownAreas: goal ? getKnownSubjects(goal) : [],
    measuredLevel: goal && isLevelMeasured(goal) ? getOwnLevel({ goal }) : null,
    quickFormat: getPlacementQuickFormat(structure ?? notice),
    trueFalseLabels: getTrueFalseLabels(structure ?? notice),
    typed: goal ? confirmsInWriting(goal) : false,
  };
}

async function loadQuestion(
  itemId: string | undefined,
  tx: TransactionClient = prisma,
): Promise<PlacementQuestionView | null> {
  if (!itemId) {
    return null;
  }

  const item = await tx.item.findUnique({ include: ITEM_IMAGE_INCLUDE, where: { id: itemId } });
  const parsed = item ? parsePlacementItem(item) : null;

  return parsed ? toPlacementQuestionView(parsed) : null;
}

function getStatus({
  buildFailed,
  complete,
  dayBudgetUsed,
  hasEvidence,
  hasNext,
  hasSkills,
  waitsForQuestions,
}: {
  buildFailed: boolean;
  complete: boolean;
  dayBudgetUsed: boolean;
  /** Any answer on the plan's skills, placement's or not. */
  hasEvidence: boolean;
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

  return hasEvidence ? "done" : "unavailable";
}

/** Uses all answers, not only placement's; today applies the learner-local daily budget. */
export async function loadPlacementState({
  answer: sessionAnswer = null,
  goalId,
  ownLevel: requestedLevel,
  plan,
  today = null,
  userId,
  tx = prisma,
}: {
  /** Include a placement question answered inside a first-week session. */
  answer?: PlacementEvidence | null;
  goalId: string;
  /** A level the request gave; the one stored on the goal otherwise. */
  ownLevel?: OwnLevel | null;
  plan: GoalPlan;
  today?: Date | null;
  userId: string;
  tx?: TransactionClient;
}): Promise<PlacementState> {
  const skills = plan.skills;
  const skillIds = skills.map((skill) => skill.id);

  const {
    answeredOnly,
    examBlueprintId,
    areaShares,
    focusAreas,
    focusedSkillIds,
    goalCreatedAt,
    goalLevel,
    knownAreas,
    measuredLevel,
    quickFormat,
    trueFalseLabels,
    typed,
  } = await loadGoalExam(goalId, tx);

  const ownLevel = requestedLevel ?? goalLevel;

  const [{ attempts, evidence, placementAnswers, seenItemIds }, { bankItems, build }] =
    await Promise.all([
      loadEvidence({ skillIds, tx, userId }),
      loadPlanBuild({
        everySkill: answeredOnly,
        focusAreas,
        goalId,
        knownAreas,
        ownLevel,
        tx,
      }).then(async (planBuild) => ({
        bankItems: await loadPlacementItems({
          examBlueprintId,
          skillIds,
          tx,
          typed,
          writingSkillIds: planBuild.preparingSkillIds,
        }),
        build: planBuild,
      })),
    ]);

  const items: PlacementItemCandidate[] = bankItems.map((item) => ({
    ...item,
    seen: seenItemIds.has(item.id),
  }));

  /** Keep the full material's budget stable while question batches arrive or time out. */
  const topics = answeredOnly ? skills.length : 0;

  const dayBudgetSpent =
    today === null
      ? 0
      : getPlacementBudgetSpent({
          answers: attempts.filter((attempt) => isPlacementAnswerOn({ attempt, day: today })),
          topics,
        });

  const dayBudgetUsed = dayBudgetSpent >= 1;

  const answers = sessionAnswer ? [...placementAnswers, sessionAnswer] : placementAnswers;

  const measuredKnown = new Set(
    listKnownByMeasuredLevel({ evidence, level: measuredLevel, skills }),
  );

  const statuses: SkillStatuses = new Map(
    [
      ...readSkillStatuses({
        answeredOnly,
        answers,
        evidence,
        focusedSkillIds,
        knownAreas,
        ownLevel,
        skills,
      }),
    ].map(([skillId, status]) => [skillId, measuredKnown.has(skillId) ? "known" : status]),
  );

  const complete = isPlacementSettled({ answeredOnly, skills, statuses });
  const askableSkillIds = new Set(items.filter((item) => !item.seen).map((item) => item.skillId));

  const needsItems = getUndecidedSkills({ answeredOnly, skills, statuses })
    .filter((skill) => !askableSkillIds.has(skill.id))
    .map((skill) => skill.id);

  const nextSkillId = chooseNextSkill({
    askableSkillIds,
    choice: { answeredOnly, areaShares, evidence, focusAreas, ownLevel, skills, statuses },
    preparingSkillIds: build.preparingSkillIds,
    quickSkillIds: new Set(
      items.filter((item) => !item.seen && item.format === quickFormat).map((item) => item.skillId),
    ),
  });

  const waitsForNext = nextSkillId !== null && !askableSkillIds.has(nextSkillId);

  const nextItem =
    nextSkillId && !waitsForNext && !build.waitsForExam
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

  const next = dayBudgetUsed ? null : await loadQuestion(nextItem?.id, tx);
  const answered = countPlacementAnswers({ attempts, since: goalCreatedAt });

  return {
    answered,
    areas: getAreaStarts({ skills, statuses }),
    complete,
    dayBudgetSpent,
    dayBudgetUsed,
    knownSkillIds: [
      ...new Set([
        ...listKnownSkillIds({ answers, evidence, focusedSkillIds, skillIds }),
        ...measuredKnown,
      ]),
    ],
    needsItems,
    next,
    phases: getPhaseStarts({ skills, statuses }),
    started: answered > 0,
    status: getStatus({
      buildFailed: build.failed,
      complete,
      dayBudgetUsed,
      hasEvidence: evidence.length > 0,
      hasNext: next !== null,
      hasSkills: skills.length > 0 && !build.waitsForExam,
      waitsForQuestions: waitsForNext,
    }),
    trueFalseLabels,
  };
}
