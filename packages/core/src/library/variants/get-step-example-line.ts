import "server-only";
import { generateExampleLines } from "@zoonk/ai/tasks/v2/variants/example-lines";
import { type StepExampleLine, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { toProvenanceData } from "../_utils/library-rows";
import { canViewLibraryRow } from "../_utils/library-visibility";
import { safeParseStepContent } from "../steps/contract/step-contract";
import { type ExampleLineContext, loadExampleLineContext } from "./_utils/example-line-context";

type StepExampleLineResult =
  | { status: "unauthorized" }
  | { status: "notFound" }
  | RefusedUsage
  | { line: string | null; status: "ready" };

type LessonLines =
  | { status: "unauthorized" }
  | RefusedUsage
  | { lines: StepExampleLine[]; status: "ready" };

type LessonLinesInput = {
  context: ExampleLineContext;
  language: string;
  lessonId: string;
  userId: string;
  /** The version of the lesson the asking screen belongs to. */
  version: number;
};

/** The learner's latest lines from other lessons the model sees, so new lines tell new moments. */
const EARLIER_LINE_LIMIT = 8;

/**
 * Lessons whose lines are being written on this server, by learner, lesson and what they shared,
 * so a screen asked for meanwhile (a quick tap ahead, a remount) waits for the same call instead of
 * paying again. Other servers rely on the (learner, screen) unique key: the lines stored first win,
 * so a lesson never mixes lines written apart.
 */
const writing = new Map<string, Promise<LessonLines>>();

/** The personal example slot an explanation's writer left, or undefined. */
function getSlot(content: unknown) {
  const parsed = safeParseStepContent("explanation", content);

  return parsed.success && parsed.data.exampleLineSlot
    ? { idea: parsed.data.exampleLineSlot.idea, text: parsed.data.text }
    : undefined;
}

/** An explanation the learner can see, with whether its writer left a slot for a personal example. */
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

/**
 * The lesson's explanations with a slot, in lesson order: every screen whose line is written
 * together. They're the asking screen's version's, so a learner finishing a version a check
 * replaced gets lines for the screens they see.
 */
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

/** The learner's stored lines for these screens that were written from what they share now. */
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

/** The learner's latest lines from other lessons, newest first, so new lines tell new moments. */
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

/**
 * Writes the lines of every slot in the lesson that has none from what the learner shares now, in
 * one model call, so each screen gets its own moment (or none): the model sees the screens
 * together, the lines this lesson already shows and the learner's latest ones. Lines written from
 * facts they no longer share are replaced, and lines another server stored first are kept.
 */
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

  await prisma.$transaction([
    prisma.stepExampleLine.deleteMany({
      where: { contextKey: { not: context.key }, stepId: { in: missingIds }, userId },
    }),
    prisma.stepExampleLine.createMany({
      data: missing.map((screen, index) => ({
        ...toProvenanceData(provenance),
        contextKey: context.key,
        stepId: screen.id,
        text: data.lines[index] ?? null,
        userId,
      })),
      skipDuplicates: true,
    }),
  ]);

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

/**
 * The example line for the signed-in learner on one explanation: a sentence that ties the idea to
 * their own life, built from what they shared. A lesson's lines are written together the first
 * time one of its screens asks, so each screen tells a different moment, and kept until the
 * learner's facts or goal change; memory marks the facts it hands over as used. `line` is null
 * when the screen has no slot, the learner shared nothing, or nothing they shared fits in a moment
 * this lesson's other lines and their recent ones didn't already use. New lines are claimed as one
 * small AI help, so only a POST (`POST /v1/me/example-lines/{stepId}`, which the web player calls
 * from the browser) may call this.
 */
export async function getStepExampleLine({
  stepId,
}: {
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
    return { line: null, status: "ready" };
  }

  const cached = await prisma.stepExampleLine.findUnique({
    where: { userStep: { stepId, userId } },
  });

  if (cached?.contextKey === context.key) {
    return { line: cached.text, status: "ready" };
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
    line: written.lines.find((row) => row.stepId === stepId)?.text ?? null,
    status: "ready",
  };
}
