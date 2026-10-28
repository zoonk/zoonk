import "server-only";
import { generateExampleLines } from "@zoonk/ai/tasks/v2/variants/example-lines";
import { type StepExampleLine, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { markMemoryFactsUsed } from "../../memory/_utils/mark-facts-used";
import { getSession } from "../../users/get-session";
import { toProvenanceData } from "../_utils/library-rows";
import { canViewLibraryRow } from "../_utils/library-visibility";
import { safeParseStepContent } from "../steps/contract/step-contract";
import { type ExampleLineContext, loadExampleLineContext } from "./_utils/example-line-context";

type StepExampleLineResult =
  | { status: "unauthorized" }
  | { status: "notFound" }
  | RefusedUsage
  | { canRequest: boolean; line: string | null; status: "ready" };

type LessonLines =
  | { status: "unauthorized" }
  | RefusedUsage
  | { lines: StepExampleLine[]; status: "ready" };

type LessonLinesInput = {
  context: ExampleLineContext;
  language: string;
  lessonId: string;
  userId: string;
  version: number;
};

const EARLIER_LINE_LIMIT = 8;

const writing = new Map<string, Promise<LessonLines>>();

function getSlot(content: unknown) {
  const parsed = safeParseStepContent("explanation", content);

  return parsed.success && parsed.data.exampleLineSlot
    ? { idea: parsed.data.exampleLineSlot.idea, text: parsed.data.text }
    : undefined;
}

async function findExplanation(stepId: string) {
  const step = await prisma.step.findUnique({
    include: { lesson: { select: { language: true, ownerId: true, visibility: true } } },
    where: { id: stepId },
  });

  if (step?.kind !== "explanation" || !(await canViewLibraryRow(step.lesson))) {
    return null;
  }

  return {
    hasSlot: Boolean(getSlot(step.content)),
    language: step.lesson.language,
    lessonId: step.lessonId,
    version: step.version,
  };
}

async function loadSlotScreens({ lessonId, version }: { lessonId: string; version: number }) {
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

async function loadCurrentLines({
  contextKey,
  stepIds,
  userId,
}: {
  contextKey: string;
  stepIds: string[];
  userId: string;
}): Promise<StepExampleLine[]> {
  return prisma.stepExampleLine.findMany({
    where: { contextKey, stepId: { in: stepIds }, userId },
  });
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

async function writeLessonLines({
  context,
  language,
  lessonId,
  userId,
  version,
}: LessonLinesInput): Promise<LessonLines> {
  const screens = await loadSlotScreens({ lessonId, version });
  const stepIds = screens.map((screen) => screen.id);
  const current = await loadCurrentLines({ contextKey: context.key, stepIds, userId });
  const missing = screens.filter((screen) => !current.some((row) => row.stepId === screen.id));

  if (missing.length === 0) {
    return { lines: current, status: "ready" };
  }

  const usage = await claimAssist();

  if (usage.status !== "allowed") {
    return usage;
  }

  await markMemoryFactsUsed({ ids: context.facts.map((fact) => fact.id), now: new Date(), userId });

  const { data, provenance } = await generateExampleLines({
    analytics: { contentScope: "personal", distinctId: userId },
    earlierLines: [
      ...current.flatMap((row) => row.text ?? []),
      ...(await loadEarlierLines({ lessonId, userId })),
    ],
    facts: context.facts.map((fact) => fact.statement),
    goal: context.goal,
    language,
    screens: missing.map(({ idea, text }) => ({ idea, text })),
  });

  const missingIds = missing.map((screen) => screen.id);

  await writeLearnerChange({ userId }, async (tx) => {
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

    if (removed.count === 0 && created.count === 0) {
      return unchanged(null);
    }
  });

  return {
    lines: await loadCurrentLines({ contextKey: context.key, stepIds, userId }),
    status: "ready",
  };
}

function writeLessonLinesOnce(input: LessonLinesInput): Promise<LessonLines> {
  const key = `${input.userId}:${input.lessonId}:${input.version}:${input.context.key}`;
  const pending = writing.get(key);

  if (pending) {
    return pending;
  }

  const started = writeLessonLines(input).finally(() => writing.delete(key));
  writing.set(key, started);
  return started;
}

/** Read-only: use `requestStepExampleLine` from a learner-action POST to generate missing lines. */
export function getStepExampleLine({ stepId }: { stepId: string }): Promise<StepExampleLineResult> {
  return resolveStepExampleLine({ create: false, stepId });
}

/** Call only from a learner-action POST, never while opening a page. */
export function requestStepExampleLine({
  stepId,
}: {
  stepId: string;
}): Promise<StepExampleLineResult> {
  return resolveStepExampleLine({ create: true, stepId });
}

async function resolveStepExampleLine({
  create,
  stepId,
}: {
  create: boolean;
  stepId: string;
}): Promise<StepExampleLineResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const screen = isUuid(stepId) ? await findExplanation(stepId) : null;

  if (!screen) {
    return { status: "notFound" };
  }

  const context = screen.hasSlot
    ? await loadExampleLineContext({ language: screen.language, userId })
    : null;

  if (!context) {
    return { canRequest: false, line: null, status: "ready" };
  }

  const cached = await prisma.stepExampleLine.findUnique({
    where: { userStep: { stepId, userId } },
  });

  if (cached?.contextKey === context.key) {
    return { canRequest: false, line: cached.text, status: "ready" };
  }

  if (!create) {
    return { canRequest: true, line: null, status: "ready" };
  }

  const written = await writeLessonLinesOnce({
    context,
    language: screen.language,
    lessonId: screen.lessonId,
    userId,
    version: screen.version,
  });

  if (written.status !== "ready") {
    return written;
  }

  return {
    canRequest: false,
    line: written.lines.find((row) => row.stepId === stepId)?.text ?? null,
    status: "ready",
  };
}
