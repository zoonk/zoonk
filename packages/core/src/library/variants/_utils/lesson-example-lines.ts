import "server-only";
import { type CallWait } from "@zoonk/ai/provider-options";
import { generateExampleLines } from "@zoonk/ai/tasks/variants/example-lines";
import { MemoryCategory, type StepExampleLine, prisma } from "@zoonk/db";
import { type RefusedUsage, type UsageDecision } from "../../../entitlements/contract";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { markMemoryFactsUsed } from "../../../memory/_utils/mark-facts-used";
import { findMemoryForStep, findMemoryForTask } from "../../../memory/get-memory-for-task";
import { toProvenanceData } from "../../_utils/library-rows";
import { getLessonCountry } from "../../content-country";
import { safeParseStepContent } from "../../steps/contract/step-contract";
import { type ExampleLineContext, loadExampleLineContext } from "./example-line-context";

export type LessonLines =
  | { status: "unauthorized" }
  | RefusedUsage
  | { canRequest: boolean; lines: StepExampleLine[]; status: "ready" };

export type ExampleLineFact = { id: string; statement: string };

export type LessonLinesInput = {
  country: string | null;
  context: ExampleLineContext;
  language: string;
  lessonId: string;
  userId: string;
  version: number;
};

const EARLIER_LINE_LIMIT = 8;

/**
 * Names no lesson topic: a topic pulls the check toward facts about that subject, so a developer's
 * coding lessons only ever got their software work, which repeats the screen.
 */
const EXAMPLE_LINE_NEED =
  "Write a personal example that shows a lesson's idea in a familiar part of the learner's life: their work, routine, home, hobbies or the sports and interests they follow";

function getSlot(content: unknown) {
  const parsed = safeParseStepContent("explanation", content);

  return parsed.success && parsed.data.exampleLineSlot
    ? { idea: parsed.data.exampleLineSlot.idea, text: parsed.data.text }
    : undefined;
}

export async function loadLessonOfStep(stepId: string) {
  const step = await prisma.step.findUnique({
    include: {
      lesson: {
        select: {
          homeChapter: { select: { homeCourse: { select: { country: true } } } },
          language: true,
          ownerId: true,
          visibility: true,
        },
      },
      skill: { select: { country: true } },
    },
    where: { id: stepId },
  });

  if (!step) {
    return null;
  }

  return {
    country: getLessonCountry({ course: step.lesson.homeChapter?.homeCourse, skill: step.skill }),
    hasSlot: step.kind === "explanation" && Boolean(getSlot(step.content)),
    kind: step.kind,
    language: step.lesson.language,
    lesson: step.lesson,
    lessonId: step.lessonId,
    version: step.version,
  };
}

export async function loadSlotScreens({
  lessonId,
  version,
}: {
  lessonId: string;
  version: number;
}) {
  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { content: true, id: true },
    where: { kind: "explanation", lessonId, version },
  });

  return steps.flatMap((step) => {
    const slot = getSlot(step.content);
    return slot ? [{ id: step.id, ...slot }] : [];
  });
}

export async function findMissingScreens({
  context,
  lessonId,
  userId,
  version,
}: Pick<LessonLinesInput, "context" | "lessonId" | "userId" | "version">) {
  const screens = await loadSlotScreens({ lessonId, version });
  const stepIds = screens.map((screen) => screen.id);

  const current = await prisma.stepExampleLine.findMany({
    where: { contextKey: context.key, stepId: { in: stepIds }, userId },
  });

  const missing = screens.filter((screen) => !current.some((row) => row.stepId === screen.id));

  return { current, missing, stepIds };
}

async function loadEarlierLines({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<string[]> {
  const rows = await prisma.stepExampleLine.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { text: true },
    take: EARLIER_LINE_LIMIT,
    where: { step: { lessonId: { not: lessonId } }, text: { not: null }, userId },
  });

  return rows.flatMap((row) => row.text ?? []);
}

export async function pickExampleLineFacts({
  context,
  inStep = false,
  userId,
}: {
  context: ExampleLineContext;
  /** A workflow step lets a failed relevance check throw so it retries; a waiting learner gets the newest facts. */
  inStep?: boolean;
  userId: string;
}): Promise<ExampleLineFact[]> {
  const find = inStep ? findMemoryForStep : findMemoryForTask;

  const picked = await find({
    analytics: { contentScope: "personal", distinctId: userId },
    candidateIds: context.facts.map((fact) => fact.id),
    categories: Object.values(MemoryCategory),
    need: EXAMPLE_LINE_NEED,
    userId,
  });

  return picked.map(({ id, statement }) => ({ id, statement }));
}

/** Claims before the model call and saves only while the learner's context is still the one written for. */
export async function writeLessonLines({
  claim,
  country,
  context,
  facts,
  language,
  lessonId,
  userId,
  version,
  wait,
}: LessonLinesInput & {
  claim: () => Promise<UsageDecision>;
  /** Picked after the claim when absent, so a refused claim spends nothing. */
  facts?: ExampleLineFact[];
  wait: CallWait;
}): Promise<LessonLines> {
  const { current, missing, stepIds } = await findMissingScreens({
    context,
    lessonId,
    userId,
    version,
  });

  if (missing.length === 0) {
    return { canRequest: false, lines: current, status: "ready" };
  }

  const usage = await claim();

  if (usage.status !== "allowed") {
    return usage;
  }

  const picked = facts ?? (await pickExampleLineFacts({ context, userId }));

  const { data, provenance } = await generateExampleLines({
    analytics: { contentScope: "personal", distinctId: userId },
    country,
    earlierLines: [
      ...current.flatMap((row) => row.text ?? []),
      ...(await loadEarlierLines({ lessonId, userId })),
    ],
    facts: picked.map((fact) => fact.statement),
    goal: context.goal,
    language,
    learnerHomeCountry: context.learnerHomeCountry,
    plainWords: context.plainWords,
    screens: missing.map(({ idea, text }) => ({ idea, text })),
    wait,
  });

  const missingIds = missing.map((screen) => screen.id);

  return writeLearnerChange<LessonLines>({ userId }, async (tx) => {
    const fresh = await loadExampleLineContext({ client: tx, userId });

    if (fresh?.key !== context.key) {
      return unchanged({ canRequest: fresh !== null, lines: [], status: "ready" });
    }

    await markMemoryFactsUsed({
      client: tx,
      ids: picked.map((fact) => fact.id),
      now: new Date(),
      userId,
    });

    const removed = await tx.stepExampleLine.deleteMany({
      where: { contextKey: { not: context.key }, stepId: { in: missingIds }, userId },
    });

    const created = await tx.stepExampleLine.createMany({
      data: missing.map((screen, index) => ({
        ...toProvenanceData(provenance),
        contextKey: context.key,
        stepId: screen.id,
        text: data.lines[index] ?? null,
        userId,
      })),
      skipDuplicates: true,
    });

    const lines = await tx.stepExampleLine.findMany({
      where: { contextKey: context.key, stepId: { in: stepIds }, userId },
    });

    const result = { canRequest: false, lines, status: "ready" as const };

    if (removed.count === 0 && created.count === 0) {
      return unchanged(result);
    }

    return result;
  });
}
