import "server-only";
import { NO_INSTALL_TOOL_KEY } from "@zoonk/ai/tasks/v2/variants/step-variant";
import { type StepKind, type StepVariant, prisma } from "@zoonk/db";
import { type PlanToolChoice, parsePlanSettings } from "../../plans/planner/plan-state";
import { findLearnerLessonPlan } from "../_utils/learner-lesson-plan";
import { getToolKey, parseChapterTools } from "../chapters/chapter-tools";
import { getGoalField } from "../items/item-field";
import { toVariantKey } from "./variant-keys";

/** The screens a tool version replaces: the ones a learner would do in the tool. */
export const TOOL_VERSION_SCREENS: ReadonlySet<StepKind> = new Set([
  "check",
  "explanation",
  "workedExample",
]);

/** A tool version: its stored key, and the tool's full name as the writer reads it. */
export type ToolVersion = { key: string; label: string };

/**
 * The personal layer over a lesson's shared screens: the field its chapter challenge is set in,
 * and the tool its hands-on screens are shown in (or the no-install version).
 */
export type LearnerVersionKeys = { field: string | null; tool: ToolVersion | null };

const NO_VERSIONS: LearnerVersionKeys = { field: null, tool: null };

type ChapterTool = ReturnType<typeof parseChapterTools>[number];

/**
 * The version a chapter's lessons are shown in for the learner's tool choice: the first of the
 * chapter's tools they answered for, essential ones first. "No install" gets the version that
 * turns running things on a device into examples; having the tool or setting it up gets the
 * version in that tool. Null when they haven't answered for any of the chapter's tools.
 */
export function pickToolVersion({
  choices,
  tools,
}: {
  choices: readonly PlanToolChoice[];
  tools: readonly ChapterTool[];
}): ToolVersion | null {
  const answered = tools
    .toSorted((a, b) => Number(b.essential) - Number(a.essential))
    .flatMap((tool) => {
      const choice = choices.find((item) => getToolKey(item.name) === getToolKey(tool.name));
      return choice ? [{ choice: choice.choice, tool }] : [];
    });

  const [first] = answered;

  if (!first) {
    return null;
  }

  return first.choice === "none"
    ? { key: NO_INSTALL_TOOL_KEY, label: NO_INSTALL_TOOL_KEY }
    : { key: toVariantKey(getToolKey(first.tool.name)), label: first.tool.name };
}

/** The tools of the chapters a plan has a lesson in. */
export async function loadChapterToolsById(
  chapterIds: readonly string[],
): Promise<Map<string, ChapterTool[]>> {
  const chapters =
    chapterIds.length > 0
      ? await prisma.chapter.findMany({
          select: { id: true, tools: true },
          where: { id: { in: [...new Set(chapterIds)] } },
        })
      : [];

  return new Map(chapters.map((chapter) => [chapter.id, parseChapterTools(chapter.tools)]));
}

/**
 * Which personal versions a learner gets for one lesson, from the plan they play it for: their
 * goal's field, and their tool choice for the chapter the lesson sits in there.
 */
export async function loadLearnerVersionKeys({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<LearnerVersionKeys> {
  const plan = await findLearnerLessonPlan({ lessonId, userId });

  if (!plan) {
    return NO_VERSIONS;
  }

  const chapterIds = plan.items.flatMap((item) => item.chapterId ?? []);
  const toolsByChapter = await loadChapterToolsById(chapterIds);

  return {
    field: getGoalField(plan.goal.details),
    tool: pickToolVersion({
      choices: parsePlanSettings(plan.settings).tools,
      tools: chapterIds.flatMap((chapterId) => toolsByChapter.get(chapterId) ?? []),
    }),
  };
}

/** A challenge takes the field's case; other hands-on screens take the tool's version. */
function getWantedVersion({
  keys,
  stepKind,
}: {
  keys: LearnerVersionKeys;
  stepKind: StepKind;
}): { key: string; kind: "field" | "tool" } | null {
  if (stepKind === "challenge") {
    return keys.field ? { key: keys.field, kind: "field" } : null;
  }

  return keys.tool && TOOL_VERSION_SCREENS.has(stepKind)
    ? { key: keys.tool.key, kind: "tool" }
    : null;
}

/** The stored version that replaces one screen for this learner, if it has been made. */
export function findLearnerVersion({
  keys,
  step,
  versions,
}: {
  keys: LearnerVersionKeys;
  step: { id: string; kind: StepKind };
  versions: readonly StepVariant[];
}): StepVariant | undefined {
  const wanted = getWantedVersion({ keys, stepKind: step.kind });

  return wanted
    ? versions.find(
        (version) =>
          version.stepId === step.id && version.kind === wanted.kind && version.key === wanted.key,
      )
    : undefined;
}

/** The field and tool versions already made for these screens, in the learner's keys. */
export async function loadLearnerVersions({
  keys,
  stepIds,
}: {
  keys: LearnerVersionKeys;
  stepIds: readonly string[];
}): Promise<StepVariant[]> {
  const wanted = [
    ...(keys.field ? [{ key: keys.field, kind: "field" as const }] : []),
    ...(keys.tool ? [{ key: keys.tool.key, kind: "tool" as const }] : []),
  ];

  if (wanted.length === 0 || stepIds.length === 0) {
    return [];
  }

  return prisma.stepVariant.findMany({ where: { OR: wanted, stepId: { in: [...stepIds] } } });
}

/**
 * Stored screens as this learner sees them: a screen with a version in their field or tool
 * carries that version's content, and every other screen stays the shared one. Grading, the
 * lesson's completion and the tutor read the same rows, so they judge what the learner saw.
 */
export async function withLearnerVersionRows<
  TRow extends { content: StepVariant["content"]; id: string; kind: StepKind },
>({ lessonId, rows, userId }: { lessonId: string; rows: TRow[]; userId: string }): Promise<TRow[]> {
  const keys = await loadLearnerVersionKeys({ lessonId, userId });
  const versions = await loadLearnerVersions({ keys, stepIds: rows.map((row) => row.id) });

  if (versions.length === 0) {
    return rows;
  }

  return rows.map((row) => {
    const version = findLearnerVersion({ keys, step: row, versions });
    return version ? { ...row, content: version.content } : row;
  });
}
