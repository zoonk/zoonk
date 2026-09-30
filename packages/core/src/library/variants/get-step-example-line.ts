import "server-only";
import { generateExampleLine } from "@zoonk/ai/tasks/v2/variants/example-line";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import { toProvenanceData } from "../_utils/library-rows";
import { canViewLibraryRow } from "../_utils/library-visibility";
import { safeParseStepContent } from "../steps/contract/step-contract";
import { loadExampleLineContext } from "./_utils/example-line-context";

type StepExampleLineResult =
  | { status: "unauthorized" }
  | { status: "notFound" }
  | RefusedUsage
  | { line: string | null; status: "ready" };

/** An explanation the learner can see, with the slot where a personal example goes. */
async function findSlot(stepId: string) {
  const step = await prisma.step.findUnique({
    include: { lesson: { select: { language: true, ownerId: true, visibility: true } } },
    where: { id: stepId },
  });

  if (step?.kind !== "explanation" || !(await canViewLibraryRow(step.lesson))) {
    return null;
  }

  const parsed = safeParseStepContent("explanation", step.content);
  const slot = parsed.success ? parsed.data.exampleLineSlot : undefined;

  return { language: step.lesson.language, slot, text: parsed.data?.text ?? "" };
}

/**
 * The example line for the signed-in learner on one explanation: a sentence
 * that ties the idea to their own life, built from what they shared. It's
 * written once per learner and screen and kept until their facts or goal
 * change; memory marks the facts it hands over as used. `line` is
 * null when the screen has no slot, the learner shared nothing, or nothing
 * they shared fits. A new line is claimed as small AI help, so only a POST
 * (`POST /v1/me/example-lines/{stepId}`, which the web player calls from the
 * browser) may call this.
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
  const screen = isUuid(stepId) ? await findSlot(stepId) : null;

  if (!screen) {
    return { status: "notFound" };
  }

  const context = screen.slot
    ? await loadExampleLineContext({ language: screen.language, userId })
    : null;

  if (!screen.slot || !context) {
    return { line: null, status: "ready" };
  }

  const cached = await prisma.stepExampleLine.findUnique({
    where: { userStep: { stepId, userId } },
  });

  if (cached?.contextKey === context.key) {
    return { line: cached.text, status: "ready" };
  }

  const usage = await claimAssist();

  if (usage.status !== "allowed") {
    return usage;
  }

  const { data, provenance } = await generateExampleLine({
    analytics: { contentScope: "personal", distinctId: userId },
    facts: context.facts.map((fact) => fact.statement),
    goal: context.goal,
    idea: screen.slot.idea,
    language: screen.language,
    screenText: screen.text,
  });

  const saved = { contextKey: context.key, text: data.line, ...toProvenanceData(provenance) };

  await prisma.stepExampleLine.upsert({
    create: { ...saved, stepId, userId },
    update: saved,
    where: { userStep: { stepId, userId } },
  });

  return { line: data.line, status: "ready" };
}
