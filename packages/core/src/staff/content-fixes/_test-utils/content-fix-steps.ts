import { STAFF_PROPOSE_SCOPE, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { type PasskeyAssertion } from "@zoonk/auth/passkey-approval-contract";
import { type Step, prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { vi } from "vitest";
import { cliTokenFixture } from "../../../../../auth/src/_test-utils/cli-tokens";
import {
  passkeyFixture,
  signApproval,
} from "../../../../../auth/src/passkeys/_test-utils/passkey-authenticator";
import { mockSession } from "../../../_test-utils/mock-session";
import {
  type ContentFixDecision,
  approveContentFixes,
  getContentFixApprovalOptions,
  rejectContentFix,
} from "../decide-content-fix";
import {
  proposeContentFix,
  proposeContentFixRevert,
  proposeContentFixRevertInAdmin,
} from "../propose-content-fix";

export const PROPOSE_SCOPES = [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE, "offline_access"];

export const intro = { text: "Two and two make four.", title: "Adding" };

export const question = {
  basis: { position: 0, quote: "Two and two make four." },
  options: [
    { id: "a", isCorrect: true, reason: "Two and two make four.", text: "4" },
    { id: "b", isCorrect: false, reason: "That's two and three.", text: "5" },
  ],
  question: "What is 2 + 2?",
};

export async function signInProposer(scopes = PROPOSE_SCOPES) {
  const user = await userFixture({ role: "admin" });
  const { accessToken } = await cliTokenFixture({ scopes, user });
  vi.mocked(headers).mockResolvedValue(new Headers({ authorization: `Bearer ${accessToken}` }));
  return user;
}

export async function signInApprover() {
  const user = await userFixture({ role: "admin" });
  const key = await passkeyFixture(user.id);
  mockSession(user.id);
  return { key, user };
}

export async function publishedLesson() {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });

  const [reading, check] = await Promise.all([
    libraryStepFixture({ content: intro, lessonId: lesson.id, position: 0 }),
    libraryStepFixture({ content: question, kind: "check", lessonId: lesson.id, position: 1 }),
  ]);

  return { check, lesson, reading };
}

export function fixedQuestion(step: Pick<Step, "id">) {
  return {
    changes: [
      {
        id: step.id,
        model: "Step",
        set: { content: { ...question, question: "What is 2 plus 2?" } },
      },
    ],
    reason: "Spell out the operation for screen readers.",
  };
}

export function rename(id: string, title: string) {
  return { id, model: "Lesson", set: { title } };
}

async function proposeBatch(input: unknown) {
  const result = await proposeContentFix(input);

  if (result.status !== "proposed") {
    throw new Error(`Expected a proposal, got ${JSON.stringify(result)}`);
  }

  return result;
}

function firstFix<Fix>(fixes: readonly Fix[]): Fix {
  const [fix] = fixes;

  if (!fix) {
    throw new Error("Expected a fix");
  }

  return fix;
}

export async function proposeFix(input: unknown) {
  const batch = await proposeBatch(input);
  return firstFix(batch.fixes);
}

type Proposal = Awaited<ReturnType<typeof proposeContentFix>>;

/** A single fix's proposal, as a batch of one. */
function single(result: Proposal) {
  return result.status === "proposed" ? { ...result, fix: firstFix(result.fixes) } : result;
}

export async function revertFix(input: unknown) {
  return single(await proposeContentFixRevert(input));
}

export async function revertInAdmin(input: { fixId: string; reason: string }) {
  return single(await proposeContentFixRevertInAdmin(input));
}

/** One fix's outcome out of its batch's decision. */
function decisionOf(fixId: string, result: ContentFixDecision) {
  if (result.status !== "decided") {
    return result;
  }

  const { fixes, ...decided } = result;
  return { ...decided, fix: fixes.find((fix) => fix.id === fixId) };
}

async function batchOfFix(fixId: string): Promise<string> {
  const fix = await prisma.contentFix.findUniqueOrThrow({ where: { id: fixId } });
  return fix.batchId;
}

export async function optionsFor(fixId: string) {
  return getContentFixApprovalOptions({ batchId: await batchOfFix(fixId), fixIds: [fixId] });
}

export async function approveFix({
  assertion,
  fixId,
}: {
  assertion: PasskeyAssertion;
  fixId: string;
}) {
  return decisionOf(
    fixId,
    await approveContentFixes({ assertion, batchId: await batchOfFix(fixId) }),
  );
}

export async function rejectFix(fixId: string) {
  return decisionOf(fixId, await rejectContentFix(fixId));
}

export async function approve({
  fixId,
  key,
}: {
  fixId: string;
  key: Awaited<ReturnType<typeof passkeyFixture>>;
}) {
  const options = await optionsFor(fixId);

  if (options.status !== "ready") {
    throw new Error(`Expected approval options, got ${JSON.stringify(options)}`);
  }

  return approveFix({
    assertion: signApproval({ challenge: options.options.challenge, key }),
    fixId,
  });
}
