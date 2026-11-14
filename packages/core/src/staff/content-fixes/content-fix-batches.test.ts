import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  type passkeyFixture,
  signApproval,
} from "../../../../auth/src/passkeys/_test-utils/passkey-authenticator";
import { mockSession } from "../../_test-utils/mock-session";
import {
  fixedQuestion,
  publishedLesson,
  question,
  rename,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import {
  approveContentFixes,
  getContentFixApprovalOptions,
  resumeContentFixes,
} from "./decide-content-fix";
import { proposeContentFix, proposeContentFixRevert } from "./propose-content-fix";
import { rejectContentFix } from "./reject-content-fix";

async function threeLessons() {
  return Promise.all([
    libraryLessonFixture({ contentStatus: "completed" }),
    libraryLessonFixture({ contentStatus: "completed" }),
    libraryLessonFixture({ contentStatus: "completed" }),
  ]);
}

async function proposeRenames(lessonIds: readonly string[]) {
  const result = await proposeContentFix({
    fixes: lessonIds.map((id, index) => ({
      changes: [rename(id, `Fixed title ${String(index)}`)],
      ...(index === 0 ? { reason: "This one had a typo." } : {}),
    })),
    reason: "The titles named the wrong topic.",
  });

  if (result.status !== "proposed") {
    throw new Error(`Expected a batch, got ${JSON.stringify(result)}`);
  }

  return result;
}

async function approveSelected({
  batchId,
  fixIds,
  key,
}: {
  batchId: string;
  fixIds: string[];
  key: Awaited<ReturnType<typeof passkeyFixture>>;
}) {
  const options = await getContentFixApprovalOptions({ batchId, fixIds });

  if (options.status !== "ready") {
    throw new Error(`Expected approval options, got ${JSON.stringify(options)}`);
  }

  return approveContentFixes({
    assertion: signApproval({ challenge: options.options.challenge, key }),
    batchId,
  });
}

describe("proposing a batch", () => {
  it("stores every fix under one batch with one review page, each with its own reason", async () => {
    const lessons = await threeLessons();
    await signInProposer();

    const batch = await proposeRenames(lessons.map((lesson) => lesson.id));

    expect(batch.reviewUrl).toContain(`/content-fixes/batches/${batch.batchId}`);
    expect(batch.fixes.map((fix) => fix.unitId)).toStrictEqual(lessons.map((lesson) => lesson.id));

    expect(batch.fixes.map((fix) => fix.reason)).toStrictEqual([
      "This one had a typo.",
      "The titles named the wrong topic.",
      "The titles named the wrong topic.",
    ]);

    await expect(
      prisma.contentFix.count({ where: { batchId: batch.batchId, status: "proposed" } }),
    ).resolves.toBe(3);
  });

  it("refuses the whole batch and names every fix that's wrong by its index", async () => {
    const lessons = await threeLessons();
    const proposer = await signInProposer();

    const result = await proposeContentFix({
      fixes: [
        { changes: [rename(lessons[0].id, "A good title")] },
        { changes: [{ id: lessons[1].id, model: "Lesson", set: { slug: "x" } }] },
        { changes: [{ id: lessons[2].id, model: "Lesson", rewrite: true }] },
      ],
      reason: "Several titles were wrong.",
    });

    expect(result).toMatchObject({ status: "invalid" });
    const message = result.status === "invalid" ? result.message : "";

    expect(message).not.toContain("fixes[0]");
    expect(message).toContain("fixes[1]: Lesson.slug isn't fixable");

    expect(message).toContain(
      "fixes[2]: A change carries one operation. Lesson takes set, setSkills.",
    );

    await expect(prisma.contentFix.count({ where: { proposerId: proposer.id } })).resolves.toBe(0);
  });

  it("refuses two fixes of a batch that write the same thing", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    await signInProposer();

    const result = await proposeContentFix({
      fixes: [
        { changes: [rename(lesson.id, "First title")] },
        { changes: [rename(lesson.id, "Second title")] },
      ],
      reason: "Retitle.",
    });

    expect(result).toMatchObject({
      message: expect.stringContaining("fixes[1]: fixes[0] also changes Lesson"),
      status: "invalid",
    });
  });
});

describe("approving a batch", () => {
  it("applies the selected fixes with one passkey, each applying or going stale on its own", async () => {
    const lessons = await threeLessons();
    await signInProposer();
    const batch = await proposeRenames(lessons.map((lesson) => lesson.id));
    const [first, second, third] = batch.fixes;

    if (!first || !second || !third) {
      throw new Error("Expected three fixes");
    }

    const { key, user } = await signInApprover();

    await expect(rejectContentFix(third.id)).resolves.toMatchObject({
      fixes: [{ id: third.id, status: "rejected" }],
    });

    await prisma.lesson.update({
      data: { title: "Edited meanwhile" },
      where: { id: second.unitId },
    });

    const result = await approveSelected({
      batchId: batch.batchId,
      fixIds: [first.id, second.id],
      key,
    });

    expect(result).toStrictEqual({
      cacheNotified: true,
      fixes: [
        { id: first.id, staleReason: null, status: "applied" },
        { id: second.id, staleReason: expect.any(String), status: "stale" },
        { id: third.id, staleReason: null, status: "rejected" },
      ],
      status: "decided",
    });

    const titles = await prisma.lesson.findMany({
      orderBy: { id: "asc" },
      select: { id: true, title: true },
      where: { id: { in: lessons.map((lesson) => lesson.id) } },
    });

    expect(new Map(titles.map((lesson) => [lesson.id, lesson.title]))).toStrictEqual(
      new Map([
        [lessons[0].id, "Fixed title 0"],
        [lessons[1].id, "Edited meanwhile"],
        [lessons[2].id, lessons[2].title],
      ]),
    );

    await expect(
      prisma.contentFix.findMany({
        orderBy: { id: "asc" },
        select: { decidedAt: true, deciderId: true },
        where: { id: { in: [first.id, second.id] } },
      }),
    ).resolves.toStrictEqual([
      { decidedAt: expect.any(Date), deciderId: user.id },
      { decidedAt: expect.any(Date), deciderId: user.id },
    ]);
  });

  it("asks for a fresh look when the selection no longer matches what's waiting", async () => {
    const lessons = await threeLessons();
    await signInProposer();
    const batch = await proposeRenames(lessons.map((lesson) => lesson.id));
    const fixIds = batch.fixes.map((fix) => fix.id);
    await signInApprover();

    await rejectContentFix(fixIds[0] ?? "");

    await expect(
      getContentFixApprovalOptions({ batchId: batch.batchId, fixIds }),
    ).resolves.toStrictEqual({ status: "changed" });

    await expect(
      prisma.contentFix.count({
        where: { approvalChallenge: { not: null }, batchId: batch.batchId },
      }),
    ).resolves.toBe(0);
  });

  it("lets the same approver finish fixes a crash left approved, and lets nothing join", async () => {
    const lessons = await threeLessons();
    await signInProposer();
    const batch = await proposeRenames(lessons.map((lesson) => lesson.id));
    const [first, second, waiting] = batch.fixes.map((fix) => fix.id);
    const { user } = await signInApprover();

    await prisma.contentFix.updateMany({
      data: { deciderId: user.id, status: "approved" },
      where: { id: { in: [first ?? "", second ?? ""] } },
    });

    const other = await userFixture({ role: "admin" });
    mockSession(other.id);

    await expect(resumeContentFixes(batch.batchId)).resolves.toMatchObject({
      cacheNotified: null,
      fixes: [{ status: "approved" }, { status: "approved" }, { status: "proposed" }],
    });

    mockSession(user.id);

    await expect(resumeContentFixes(batch.batchId)).resolves.toStrictEqual({
      cacheNotified: true,
      fixes: [
        { id: first, staleReason: null, status: "applied" },
        { id: second, staleReason: null, status: "applied" },
        { id: waiting, staleReason: null, status: "proposed" },
      ],
      status: "decided",
    });

    await expect(
      prisma.lesson.findUniqueOrThrow({ select: { title: true }, where: { id: lessons[2].id } }),
    ).resolves.toStrictEqual({ title: lessons[2].title });
  });
});

describe("reverting a batch", () => {
  it("proposes one inverse for each applied fix, as a new batch", async () => {
    const lessons = await threeLessons();
    await signInProposer();
    const batch = await proposeRenames(lessons.map((lesson) => lesson.id));
    const [first, second, third] = batch.fixes.map((fix) => fix.id);
    const { key } = await signInApprover();

    await rejectContentFix(third ?? "");
    await approveSelected({ batchId: batch.batchId, fixIds: [first ?? "", second ?? ""], key });
    await signInProposer();

    const revert = await proposeContentFixRevert({
      batchId: batch.batchId,
      reason: "The old titles were right.",
    });

    expect(revert).toMatchObject({
      fixes: [
        { changes: [{ fields: [{ after: lessons[0].title, field: "title" }] }], revertsId: first },
        { changes: [{ fields: [{ after: lessons[1].title, field: "title" }] }], revertsId: second },
      ],
      status: "proposed",
    });

    expect(revert.status === "proposed" && revert.batchId).not.toBe(batch.batchId);
  });

  it("leaves out a fix another revert already undid or is undoing", async () => {
    const lessons = await threeLessons();
    await signInProposer();
    const batch = await proposeRenames(lessons.map((lesson) => lesson.id));
    const [first, second, third] = batch.fixes.map((fix) => fix.id);
    const { key } = await signInApprover();

    await approveSelected({
      batchId: batch.batchId,
      fixIds: [first ?? "", second ?? "", third ?? ""],
      key,
    });

    await signInProposer();
    const undoFirst = await proposeContentFixRevert({ fixId: first ?? "", reason: "Wrong title." });

    const undoSecond = await proposeContentFixRevert({
      fixId: second ?? "",
      reason: "Wrong title.",
    });

    if (undoFirst.status !== "proposed" || undoSecond.status !== "proposed") {
      throw new Error("Expected both reverts to be proposed");
    }

    await signInApprover();

    await approveSelected({
      batchId: undoFirst.batchId,
      fixIds: undoFirst.fixes.map((fix) => fix.id),
      key,
    });

    await signInProposer();

    await expect(
      proposeContentFixRevert({ batchId: batch.batchId, reason: "The old titles were right." }),
    ).resolves.toMatchObject({
      fixes: [
        { changes: [{ fields: [{ after: lessons[2].title, field: "title" }] }], revertsId: third },
      ],
      status: "proposed",
    });

    await expect(
      proposeContentFixRevert({ batchId: batch.batchId, reason: "The old titles were right." }),
    ).resolves.toMatchObject({
      message: expect.stringContaining("already undone or has an undo waiting"),
      status: "invalid",
    });
  });

  it("applies two fixes of one lesson from one batch, one after the other", async () => {
    const { check, lesson } = await publishedLesson();
    await signInProposer();

    const result = await proposeContentFix({
      fixes: [fixedQuestion(check), { changes: [rename(lesson.id, "Adding numbers")] }],
      reason: "Clearer wording.",
    });

    expect(result).toMatchObject({ fixes: [{ unitId: lesson.id }, { unitId: lesson.id }] });

    const { key } = await signInApprover();
    const batchId = result.status === "proposed" ? result.batchId : "";
    const fixIds = result.status === "proposed" ? result.fixes.map((fix) => fix.id) : [];

    await expect(approveSelected({ batchId, fixIds, key })).resolves.toMatchObject({
      fixes: [{ status: "applied" }, { status: "applied" }],
    });

    await expect(prisma.step.findUniqueOrThrow({ where: { id: check.id } })).resolves.toMatchObject(
      { content: { ...question, question: "What is 2 plus 2?" } },
    );
  });
});
