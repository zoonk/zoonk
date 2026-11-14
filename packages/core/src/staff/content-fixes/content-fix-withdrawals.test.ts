import { STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { approve, rename, signInApprover, signInProposer } from "./_test-utils/content-fix-steps";
import { getContentFixApprovalOptions } from "./decide-content-fix";
import { proposeContentFix } from "./propose-content-fix";
import { rejectContentFix, rejectContentFixBatch } from "./reject-content-fix";
import { withdrawContentFixes } from "./withdraw-content-fix";

async function proposeThree() {
  const lessons = await Promise.all([
    libraryLessonFixture({ contentStatus: "completed" }),
    libraryLessonFixture({ contentStatus: "completed" }),
    libraryLessonFixture({ contentStatus: "completed" }),
  ]);

  const result = await proposeContentFix({
    fixes: lessons.map((lesson, index) => ({
      changes: [rename(lesson.id, `Fixed title ${String(index)}`)],
    })),
    reason: "The titles named the wrong topic.",
  });

  if (result.status !== "proposed") {
    throw new Error(`Expected a batch, got ${JSON.stringify(result)}`);
  }

  const [first, second, third] = result.fixes.map((fix) => fix.id);

  if (!first || !second || !third) {
    throw new Error("Expected three fixes");
  }

  return { batchId: result.batchId, fixIds: [first, second, third] as const, lessons };
}

describe("withdrawing a proposal", () => {
  it("withdraws the batch's waiting fixes and leaves what an approver decided", async () => {
    const proposer = await signInProposer();
    const { batchId, fixIds, lessons } = await proposeThree();
    const [applied, rejected, waiting] = fixIds;
    const { key } = await signInApprover();

    await approve({ fixId: applied, key });
    await rejectContentFix(rejected);

    await expect(withdrawContentFixes({ batchId })).resolves.toStrictEqual({
      batchId,
      fixes: [
        { id: applied, status: "applied" },
        { id: rejected, status: "rejected" },
        { id: waiting, status: "withdrawn" },
      ],
      status: "withdrawn",
      withdrawn: 1,
    });

    await expect(
      prisma.contentFix.findUniqueOrThrow({
        select: { decidedAt: true, deciderId: true },
        where: { id: waiting },
      }),
    ).resolves.toStrictEqual({ decidedAt: expect.any(Date), deciderId: proposer.id });

    await expect(
      prisma.lesson.findUniqueOrThrow({ select: { title: true }, where: { id: lessons[2].id } }),
    ).resolves.toStrictEqual({ title: lessons[2].title });
  });

  it("answers a repeat, or two at once, as withdrawn without withdrawing twice", async () => {
    await signInProposer();
    const { batchId } = await proposeThree();

    const both = await Promise.all([
      withdrawContentFixes({ batchId }),
      withdrawContentFixes({ batchId }),
    ]);

    expect(both.map((result) => result.status)).toStrictEqual(["withdrawn", "withdrawn"]);

    expect(
      both.reduce((sum, result) => sum + (result.status === "withdrawn" ? result.withdrawn : 0), 0),
    ).toBe(3);

    await expect(withdrawContentFixes({ batchId })).resolves.toMatchObject({
      status: "withdrawn",
      withdrawn: 0,
    });
  });

  it("keeps a withdrawn fix out of an approval that was about to sign it", async () => {
    await signInProposer();
    const { batchId, fixIds } = await proposeThree();
    await signInApprover();

    await expect(
      getContentFixApprovalOptions({ batchId, fixIds: [...fixIds] }),
    ).resolves.toMatchObject({ status: "ready" });

    await withdrawContentFixes({ fixId: fixIds[0] });

    await expect(
      prisma.contentFix.findUniqueOrThrow({
        select: { approvalChallenge: true, status: true },
        where: { id: fixIds[0] },
      }),
    ).resolves.toStrictEqual({ approvalChallenge: null, status: "withdrawn" });

    await expect(
      getContentFixApprovalOptions({ batchId, fixIds: [...fixIds] }),
    ).resolves.toStrictEqual({ status: "changed" });
  });

  it("refuses a fix past review and points an applied one to a revert", async () => {
    await signInProposer();
    const { batchId, fixIds } = await proposeThree();
    const [applied, approved] = fixIds;
    const { key, user } = await signInApprover();

    await approve({ fixId: applied, key });

    await prisma.contentFix.update({
      data: { deciderId: user.id, status: "approved" },
      where: { id: approved },
    });

    await expect(withdrawContentFixes({ fixId: applied })).resolves.toStrictEqual({
      message: `Nothing in ContentFix ${applied} waits for review (1 applied), so nothing was withdrawn. To undo what applied, propose a revert: pnpm zoonk staff fixes revert ${applied} --reason "…".`,
      status: "nothingToWithdraw",
    });

    await expect(withdrawContentFixes({ fixId: approved })).resolves.toMatchObject({
      message: expect.stringContaining("finishes applying in Admin"),
      status: "nothingToWithdraw",
    });

    await expect(withdrawContentFixes({ batchId })).resolves.toMatchObject({
      status: "withdrawn",
      withdrawn: 1,
    });
  });

  it("lets only the proposer withdraw, and sends others to Admin", async () => {
    await signInProposer();
    const { batchId, fixIds } = await proposeThree();

    await signInProposer();

    await expect(withdrawContentFixes({ batchId })).resolves.toMatchObject({
      message: expect.stringContaining(`/content-fixes/batches/${batchId}`),
      status: "notProposer",
    });

    await signInProposer([STAFF_READ_SCOPE]);

    await expect(withdrawContentFixes({ batchId })).resolves.toStrictEqual({
      status: "missingScope",
    });

    await expect(
      prisma.contentFix.count({ where: { id: { in: [...fixIds] }, status: "proposed" } }),
    ).resolves.toBe(3);
  });

  it("names one fix or one batch", async () => {
    await signInProposer();
    const { batchId, fixIds } = await proposeThree();

    await expect(withdrawContentFixes({ batchId, fixId: fixIds[0] })).resolves.toMatchObject({
      status: "invalid",
    });

    await expect(withdrawContentFixes({ fixId: crypto.randomUUID() })).resolves.toMatchObject({
      status: "notFound",
    });
  });
});

describe("rejecting a batch", () => {
  it("rejects the fixes still waiting, says how many, and leaves the rest", async () => {
    await signInProposer();
    const { batchId, fixIds } = await proposeThree();
    const [applied, first, second] = fixIds;
    const { key, user } = await signInApprover();

    await approve({ fixId: applied, key });

    await expect(rejectContentFixBatch(batchId)).resolves.toStrictEqual({
      cacheNotified: null,
      fixes: [
        { id: applied, staleReason: null, status: "applied" },
        { id: first, staleReason: null, status: "rejected" },
        { id: second, staleReason: null, status: "rejected" },
      ],
      rejected: 2,
      status: "decided",
    });

    await expect(rejectContentFixBatch(batchId)).resolves.toMatchObject({ rejected: 0 });

    await expect(
      prisma.contentFix.findMany({
        select: { deciderId: true },
        where: { id: { in: [first, second] } },
      }),
    ).resolves.toStrictEqual([{ deciderId: user.id }, { deciderId: user.id }]);
  });

  it("refuses a learner and an unknown batch", async () => {
    await signInProposer();
    const { batchId } = await proposeThree();

    const learner = await userFixture();
    mockSession(learner.id);
    await expect(rejectContentFixBatch(batchId)).resolves.toStrictEqual({ status: "forbidden" });

    await signInApprover();

    await expect(rejectContentFixBatch(crypto.randomUUID())).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
