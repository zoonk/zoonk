import "server-only";
import { prisma } from "@zoonk/db";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getGoalField } from "../items/item-field";
import {
  TOOL_VERSION_SCREENS,
  type ToolVersion,
  loadChapterToolsById,
  pickToolVersion,
} from "./learner-versions";

/** Tool versions one preparation writes at most; the next preparation writes the rest. */
const MAX_TOOL_VERSIONS = 40;

/** A private course's screens are personal content, counted to their owner. */
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

function loadVersionSteps(lessonIds: readonly string[]) {
  return prisma.step.findMany({
    orderBy: { position: "asc" },
    select: {
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
    },
  });
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
  // A private course is already built for its learner, so its challenge has no field version.
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

/**
 * The personal versions a learner's next lessons need and don't have yet: each hands-on screen
 * in the tool the learner chose for the lesson's chapter (or without installing anything), and
 * the chapter challenge set in their field. Only written lessons count: a lesson still being
 * written gets its versions at the next preparation, and plays the shared screens meanwhile.
 *
 * This is a workflow bridge: the goal id comes from `getSessionPreparationAccess`.
 */
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
