import "server-only";
import { type StepKind, prisma } from "@zoonk/db";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getGoalField } from "../items/item-field";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { getOptionPictureRequests, getStepImageRequest } from "../media/_utils/step-image-request";
import {
  TOOL_VERSION_SCREENS,
  type ToolVersion,
  loadChapterToolsById,
  pickToolVersion,
} from "./learner-versions";

const MAX_TOOL_VERSIONS = 40;

type VersionTarget = { ownerId: string | null; stepId: string };

export type ToolVersionTarget = VersionTarget & ToolVersion;
export type FieldChallengeTarget = VersionTarget & { field: string };

export type LearnerVersionTargets = {
  challenges: FieldChallengeTarget[];
  tools: ToolVersionTarget[];
};

const NO_TARGETS: LearnerVersionTargets = { challenges: [], tools: [] };

type PlanEntry = { chapterId: string | null; lessonId: string | null };

async function loadToolByLesson({
  entries,
  settings,
}: {
  entries: readonly PlanEntry[];
  settings: unknown;
}): Promise<Map<string, ToolVersion>> {
  const choices = parsePlanSettings(settings).tools;

  if (choices.length === 0) {
    return new Map();
  }

  const toolsByChapter = await loadChapterToolsById(
    entries.flatMap((entry) => entry.chapterId ?? []),
  );

  return new Map(
    entries.flatMap((entry) => {
      const tools = entry.chapterId ? (toolsByChapter.get(entry.chapterId) ?? []) : [];
      const tool = entry.lessonId ? pickToolVersion({ choices, tools }) : null;

      return entry.lessonId && tool ? [[entry.lessonId, tool] as const] : [];
    }),
  );
}

function asksAboutItsPictures(step: { content: unknown; kind: StepKind }): boolean {
  return getOptionPictureRequests(step).length > 0 || Boolean(getStepImageRequest(step)?.parts);
}

async function loadVersionSteps(lessonIds: readonly string[]) {
  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: {
      content: true,
      id: true,
      itemId: true,
      kind: true,
      lesson: { select: { ownerId: true } },
      lessonId: true,
      variants: { select: { key: true, kind: true }, where: { kind: { in: ["field", "tool"] } } },
    },
    where: {
      kind: { in: ["challenge", ...TOOL_VERSION_SCREENS] },
      lesson: { contentStatus: "completed" },
      lessonId: { in: [...lessonIds] },
      ...CURRENT_STEPS,
    },
  });

  return steps.filter((step) => !asksAboutItsPictures(step));
}

type VersionStep = Awaited<ReturnType<typeof loadVersionSteps>>[number];

function hasVersion({ key, kind, step }: { key: string; kind: string; step: VersionStep }) {
  return step.variants.some((variant) => variant.kind === kind && variant.key === key);
}

function toToolTarget({
  step,
  toolByLesson,
}: {
  step: VersionStep;
  toolByLesson: ReadonlyMap<string, ToolVersion>;
}): ToolVersionTarget[] {
  const tool = toolByLesson.get(step.lessonId);

  if (
    !tool ||
    step.kind === "challenge" ||
    step.itemId ||
    hasVersion({ ...tool, kind: "tool", step })
  ) {
    return [];
  }

  return [{ ...tool, ownerId: step.lesson.ownerId, stepId: step.id }];
}

function toChallengeTarget({
  field,
  step,
}: {
  field: string | null;
  step: VersionStep;
}): FieldChallengeTarget[] {
  if (
    !field ||
    step.kind !== "challenge" ||
    step.lesson.ownerId ||
    hasVersion({ key: field, kind: "field", step })
  ) {
    return [];
  }

  return [{ field, ownerId: null, stepId: step.id }];
}

/** Internal workflow bridge: the goal must come from `getSessionPreparationAccess`. */
export async function listLearnerVersionTargets({
  goalId,
  lessonIds,
}: {
  goalId: string;
  lessonIds: readonly string[];
}): Promise<LearnerVersionTargets> {
  const plan = await prisma.plan.findUnique({
    select: {
      goal: { select: { details: true } },
      items: {
        select: { chapterId: true, lessonId: true },
        where: { lessonId: { in: [...lessonIds] } },
      },
      settings: true,
    },
    where: { goalId },
  });

  if (!plan || lessonIds.length === 0) {
    return NO_TARGETS;
  }

  const field = getGoalField(plan.goal.details);
  const toolByLesson = await loadToolByLesson({ entries: plan.items, settings: plan.settings });

  if (!field && toolByLesson.size === 0) {
    return NO_TARGETS;
  }

  const steps = await loadVersionSteps(lessonIds);

  const ordered = lessonIds.flatMap((lessonId) =>
    steps.filter((step) => step.lessonId === lessonId),
  );

  return {
    challenges: ordered.flatMap((step) => toChallengeTarget({ field, step })),
    tools: ordered
      .flatMap((step) => toToolTarget({ step, toolByLesson }))
      .slice(0, MAX_TOOL_VERSIONS),
  };
}
