import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { canViewLibraryRow } from "../_utils/library-visibility";
import { loadExampleLineContext } from "./_utils/example-line-context";
import {
  type LessonLines,
  type LessonLinesInput,
  loadLessonOfStep,
  writeLessonLines,
} from "./_utils/lesson-example-lines";

type StepExampleLineResult =
  | { status: "unauthorized" }
  | { status: "notFound" }
  | RefusedUsage
  | { canRequest: boolean; line: string | null; status: "ready" };

const writing = new Map<string, Promise<LessonLines>>();

async function findExplanation(stepId: string) {
  const step = await loadLessonOfStep(stepId);

  if (step?.kind !== "explanation" || !(await canViewLibraryRow(step.lesson))) {
    return null;
  }

  return step;
}

function writeLessonLinesOnce(input: LessonLinesInput): Promise<LessonLines> {
  const key = `${input.userId}:${input.lessonId}:${input.version}:${input.context.key}`;
  const pending = writing.get(key);

  if (pending) {
    return pending;
  }

  const started = writeLessonLines({ ...input, claim: claimAssist, wait: "learner" }).finally(() =>
    writing.delete(key),
  );

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

  const context = screen.hasSlot ? await loadExampleLineContext({ userId }) : null;

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
    country: screen.country,
    language: screen.language,
    lessonId: screen.lessonId,
    userId,
    version: screen.version,
  });

  if (written.status !== "ready") {
    return written;
  }

  return {
    canRequest: written.canRequest,
    line: written.lines.find((row) => row.stepId === stepId)?.text ?? null,
    status: "ready",
  };
}
