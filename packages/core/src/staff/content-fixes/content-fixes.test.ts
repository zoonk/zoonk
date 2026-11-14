import { randomUUID } from "node:crypto";
import { STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  answerExplanationFixture,
  libraryStepFixture,
  mediaAssetFixture,
} from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, itemSetFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { cliTokenFixture } from "../../../../auth/src/_test-utils/cli-tokens";
import {
  passkeyFixture,
  signApproval,
} from "../../../../auth/src/passkeys/_test-utils/passkey-authenticator";
import { mockSession } from "../../_test-utils/mock-session";
import { getSession } from "../../users/get-session";
import {
  PROPOSE_SCOPES,
  approve,
  approveFix,
  fixedQuestion,
  intro,
  optionsFor,
  proposeFix,
  publishedLesson,
  question,
  rejectFix,
  rename,
  revertFix,
  revertInAdmin,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { approveContentFixes } from "./decide-content-fix";
import {
  proposeContentFix,
  proposeContentFixRevert,
  proposeContentFixRevertInAdmin,
} from "./propose-content-fix";
import { rejectContentFix } from "./reject-content-fix";

describe(proposeContentFix, () => {
  it("records the server's own before and after and changes nothing yet", async () => {
    const { check, lesson } = await publishedLesson();
    await answerExplanationFixture({ stepId: check.id });
    const proposer = await signInProposer();

    const fix = await proposeFix(fixedQuestion(check));

    expect(fix).toMatchObject({
      changes: [
        {
          fields: [
            {
              after: { question: "What is 2 plus 2?" },
              before: { question: "What is 2 + 2?" },
              field: "content",
            },
          ],
          id: check.id,
          model: "Step",
          op: "set",
        },
      ],
      reviewUrl: expect.stringContaining(`/content-fixes/${fix.id}`),
      status: "proposed",
      unit: "lesson",
      unitId: lesson.id,
    });

    expect(fix.effects).toStrictEqual(
      expect.arrayContaining([
        { kind: "lessonVersion", lessonId: lesson.id },
        { id: check.id, kind: "questionChanged", model: "Step" },
        { count: 1, kind: "answerExplanationsDeleted", stepId: check.id },
      ]),
    );

    await expect(prisma.step.findUniqueOrThrow({ where: { id: check.id } })).resolves.toMatchObject(
      { content: question },
    );

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({
      proposerId: proposer.id,
      reason: "Spell out the operation for screen readers.",
    });
  });

  it("asks a read-only login to log in again and refuses a learner", async () => {
    const { check } = await publishedLesson();

    await signInProposer([STAFF_READ_SCOPE, "offline_access"]);

    await expect(proposeContentFix(fixedQuestion(check))).resolves.toStrictEqual({
      status: "missingScope",
    });

    const learner = await userFixture();
    const { accessToken } = await cliTokenFixture({ scopes: PROPOSE_SCOPES, user: learner });
    vi.mocked(headers).mockResolvedValue(new Headers({ authorization: `Bearer ${accessToken}` }));

    await expect(proposeContentFix(fixedQuestion(check))).resolves.toStrictEqual({
      status: "forbidden",
    });
  });

  it.each([
    [
      "an option id",
      { ...question, options: [{ ...question.options[0], id: "c" }, question.options[1]] },
    ],
    [
      "the question and which answer is right together",
      {
        ...question,
        options: question.options.map((option) => ({ ...option, isCorrect: !option.isCorrect })),
        question: "What is 2 + 3?",
      },
    ],
    [
      "a quote the earlier screen doesn't say",
      { ...question, basis: { position: 0, quote: "Two plus two is four." } },
    ],
  ])("refuses a screen fix that changes %s", async (_, content) => {
    const { check } = await publishedLesson();
    await signInProposer();

    await expect(
      proposeContentFix({
        changes: [{ id: check.id, model: "Step", set: { content } }],
        reason: "Fix it.",
      }),
    ).resolves.toMatchObject({ status: "invalid" });
  });

  it("refuses a fix whose quoted sentence the earlier screen would stop saying", async () => {
    const { reading } = await publishedLesson();
    await signInProposer();

    await expect(
      proposeContentFix({
        changes: [
          {
            id: reading.id,
            model: "Step",
            set: { content: { ...intro, text: "Adding two twos gives four." } },
          },
        ],
        reason: "Clearer wording.",
      }),
    ).resolves.toMatchObject({ message: expect.stringContaining("quotes"), status: "invalid" });
  });

  it("refuses private lessons, unpublished lessons and changes spanning two lessons", async () => {
    const owner = await userFixture();

    const [privateLesson, draft, first, second] = await Promise.all([
      libraryLessonFixture({
        contentStatus: "completed",
        ownerId: owner.id,
        visibility: "private",
      }),
      libraryLessonFixture({ contentStatus: "pending" }),
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    await signInProposer();

    const results = await Promise.all([
      proposeContentFix({ changes: [rename(privateLesson.id, "Mine")], reason: "Rename." }),
      proposeContentFix({ changes: [rename(draft.id, "Draft")], reason: "Rename." }),
      proposeContentFix({
        changes: [rename(first.id, "One"), rename(second.id, "Two")],
        reason: "Rename.",
      }),
    ]);

    expect(results.map((result) => result.status)).toStrictEqual(["invalid", "invalid", "invalid"]);
  });

  it("refuses to edit an answer explanation in the fix whose screen change deletes it", async () => {
    const { check } = await publishedLesson();
    const explanation = await answerExplanationFixture({ stepId: check.id });
    await signInProposer();
    const { changes, reason } = fixedQuestion(check);

    await expect(
      proposeContentFix({
        changes: [
          ...changes,
          { id: explanation.id, model: "AnswerExplanation", set: { explanation: "Clearer." } },
        ],
        reason,
      }),
    ).resolves.toMatchObject({
      message: expect.stringContaining("answer explanations"),
      status: "invalid",
    });
  });

  it("keeps a lesson map's ideas and icons, letting only their words change", async () => {
    const iconId = randomUUID();

    const summary = {
      ideas: [{ iconId, label: "Adding", text: "Two and two make four." }],
      shape: "hub",
    };

    const lesson = await libraryLessonFixture({ contentStatus: "completed", summary });
    await signInProposer();

    const withIdea = (idea: object) => ({
      changes: [
        { id: lesson.id, model: "Lesson", set: { summary: { ...summary, ideas: [idea] } } },
      ],
      reason: "Fix the map.",
    });

    await expect(
      proposeContentFix(
        withIdea({ iconId: randomUUID(), label: "Adding", text: "Two and two make four." }),
      ),
    ).resolves.toMatchObject({ status: "invalid" });

    await expect(
      proposeContentFix(withIdea({ iconId, label: "Sums", text: "Two plus two is four." })),
    ).resolves.toMatchObject({ status: "proposed" });
  });
});

describe(approveContentFixes, () => {
  it("applies exactly the stored change once a staff passkey signs this fix's challenge", async () => {
    const { check, lesson } = await publishedLesson();
    const learner = await userFixture();
    const goal = await goalFixture({ userId: learner.id });
    const plan = await planFixture({ goalId: goal.id });
    await planItemFixture({ lessonId: lesson.id, planId: plan.id });
    await answerExplanationFixture({ stepId: check.id });
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const { key, user } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toStrictEqual({
      cacheNotified: true,
      fix: { id: fix.id, staleReason: null, status: "applied" },
      status: "decided",
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
      sourceVersion: plan.sourceVersion,
    });

    const [step, explanations, stored, after] = await Promise.all([
      prisma.step.findUniqueOrThrow({ where: { id: check.id } }),
      prisma.answerExplanation.count({ where: { stepId: check.id } }),
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ]);

    expect(step.content).toMatchObject({ question: "What is 2 plus 2?" });
    expect(explanations).toBe(0);

    expect(stored).toMatchObject({
      approvalChallenge: null,
      deciderId: user.id,
      status: "applied",
    });

    expect(after.updatedAt.getTime()).toBeGreaterThan(lesson.updatedAt.getTime());

    await expect(
      approveFix({ assertion: signApproval({ challenge: "used", key }), fixId: fix.id }),
    ).resolves.toMatchObject({
      cacheNotified: null,
      fix: { status: "applied" },
      status: "decided",
    });
  });

  it("marks dependent plans when an approved fix renames their lesson", async () => {
    const { lesson } = await publishedLesson();
    const learner = await userFixture();
    const goal = await goalFixture({ userId: learner.id });
    const plan = await planFixture({ goalId: goal.id });
    await planItemFixture({ lessonId: lesson.id, planId: plan.id });
    await signInProposer();

    const fix = await proposeFix({
      changes: [rename(lesson.id, "Fixed lesson title")],
      reason: "Correct the title.",
    });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
      sourceVersion: plan.sourceVersion + 1,
    });
  });

  it("ends stale and writes nothing when the content changed after the proposal", async () => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));

    const edited = { ...question, question: "How much is 2 + 2?" };
    await prisma.step.update({ data: { content: edited }, where: { id: check.id } });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { staleReason: expect.any(String), status: "stale" },
      status: "decided",
    });

    await expect(prisma.step.findUniqueOrThrow({ where: { id: check.id } })).resolves.toMatchObject(
      { content: edited },
    );
  });

  it("applies once when the same approval arrives twice at the same moment", async () => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const { key } = await signInApprover();
    const options = await optionsFor(fix.id);

    if (options.status !== "ready") {
      throw new Error("Expected approval options");
    }

    const assertion = signApproval({ challenge: options.options.challenge, key });

    const results = await Promise.all([
      approveFix({ assertion, fixId: fix.id }),
      approveFix({ assertion, fixId: fix.id }),
    ]);

    expect(
      results.map((result) => result.status === "decided" && result.fix?.status),
    ).toStrictEqual(["applied", "applied"]);

    expect(
      results.filter((result) => result.status === "decided" && result.cacheNotified === true),
    ).toHaveLength(1);

    await expect(prisma.step.findUniqueOrThrow({ where: { id: check.id } })).resolves.toMatchObject(
      { content: { question: "What is 2 plus 2?" } },
    );
  });

  it.each([
    ["another fix's challenge", { challenge: "not-this-fix" }],
    ["a passkey that skipped user verification", { userVerified: false }],
    ["another site's page", { origin: "https://www.zoonk.com.example" }],
  ])("refuses an assertion signed over %s", async (_, overrides) => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const { key } = await signInApprover();
    const options = await optionsFor(fix.id);

    if (options.status !== "ready") {
      throw new Error("Expected approval options");
    }

    await expect(
      approveFix({
        assertion: signApproval({ challenge: options.options.challenge, key, ...overrides }),
        fixId: fix.id,
      }),
    ).resolves.toStrictEqual({ status: "assertionInvalid" });

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({ status: "proposed" });
  });

  it("refuses another staff person's passkey and asks someone without one to add it", async () => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const other = await userFixture({ role: "admin" });
    const othersKey = await passkeyFixture(other.id);
    await signInApprover();
    const options = await optionsFor(fix.id);

    if (options.status !== "ready") {
      throw new Error("Expected approval options");
    }

    await expect(
      approveFix({
        assertion: signApproval({ challenge: options.options.challenge, key: othersKey }),
        fixId: fix.id,
      }),
    ).resolves.toStrictEqual({ status: "assertionInvalid" });

    const withoutPasskey = await userFixture({ role: "admin" });
    mockSession(withoutPasskey.id);

    await expect(optionsFor(fix.id)).resolves.toStrictEqual({ status: "needsPasskey" });
  });

  it("refuses a learner's session and a missing session", async () => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const learner = await userFixture();

    mockSession(learner.id);

    await expect(optionsFor(fix.id)).resolves.toStrictEqual({ status: "forbidden" });

    mockSession(null);
    await expect(rejectFix(fix.id)).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("reports an applied fix whose cache notice failed", async () => {
    vi.stubEnv("ZOONK_APP", "api");
    vi.stubEnv("APP_CACHE_SECRET", "");

    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      cacheNotified: false,
      fix: { status: "applied" },
    });

    vi.unstubAllEnvs();
  });

  it("takes a picture off one screen and keeps the drawing for its other screens", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    const asset = await mediaAssetFixture();
    const image = { alt: "A heart", prompt: "A heart from the front" };

    const [pictured, peer] = await Promise.all([
      libraryStepFixture({
        content: { ...intro, image },
        lessonId: lesson.id,
        mediaAssetId: asset.id,
        position: 0,
      }),
      libraryStepFixture({
        content: { ...intro, image },
        lessonId: lesson.id,
        mediaAssetId: asset.id,
        position: 1,
      }),
    ]);

    await signInProposer();

    const fix = await proposeFix({
      changes: [{ detachPicture: true, id: pictured.id, model: "Step" }],
      reason: "The picture shows the wrong organ.",
    });

    const { key } = await signInApprover();
    await approve({ fixId: fix.id, key });

    const steps = await prisma.step.findMany({
      select: { id: true, mediaAssetId: true, pictureRemovedAt: true },
      where: { lessonId: lesson.id },
    });

    expect(steps.find((step) => step.id === pictured.id)).toMatchObject({
      mediaAssetId: null,
      pictureRemovedAt: expect.any(Date),
    });

    expect(steps.find((step) => step.id === peer.id)).toMatchObject({
      mediaAssetId: asset.id,
      pictureRemovedAt: null,
    });

    await expect(prisma.mediaAsset.count({ where: { id: asset.id } })).resolves.toBe(1);
  });

  it("retires a practice question nothing else asks, and refuses one in a set", async () => {
    const skill = await skillFixture();
    const set = await itemSetFixture();

    const [standalone, inSet] = await Promise.all([
      itemFixture({ format: "typed", skillId: skill.id }),
      itemFixture({ format: "typed", setId: set.id, skillId: skill.id }),
    ]);

    await signInProposer();

    await expect(
      proposeContentFix({
        changes: [{ id: inSet.id, model: "Item", retire: true }],
        reason: "Wrong.",
      }),
    ).resolves.toMatchObject({ status: "invalid" });

    const fix = await proposeFix({
      changes: [{ id: standalone.id, model: "Item", retire: true }],
      reason: "Its key is wrong.",
    });

    const { key } = await signInApprover();
    await approve({ fixId: fix.id, key });

    await expect(
      prisma.item.findUniqueOrThrow({ where: { id: standalone.id } }),
    ).resolves.toMatchObject({ retiredAt: expect.any(Date) });
  });
});

describe(rejectContentFix, () => {
  it("rejects without a passkey, and a later approval returns that outcome", async () => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const { key, user } = await signInApprover();

    await expect(rejectFix(fix.id)).resolves.toMatchObject({
      fix: { status: "rejected" },
      status: "decided",
    });

    await expect(
      approveFix({ assertion: signApproval({ challenge: "any", key }), fixId: fix.id }),
    ).resolves.toMatchObject({ fix: { status: "rejected" }, status: "decided" });

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({ deciderId: user.id });
  });
});

describe(proposeContentFixRevert, () => {
  it("proposes putting back what an applied fix replaced", async () => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const { key } = await signInApprover();
    await approve({ fixId: fix.id, key });

    await signInProposer();

    const revert = await revertFix({ fixId: fix.id, reason: "The old wording tested better." });

    expect(revert).toMatchObject({
      fix: {
        changes: [{ fields: [{ after: question, field: "content" }], id: check.id }],
        revertsId: fix.id,
        status: "proposed",
      },
      status: "proposed",
    });

    await expect(revertFix({ fixId: randomUUID(), reason: "Undo." })).resolves.toMatchObject({
      status: "notFound",
    });
  });

  it("puts a detached picture back on its screen", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    const asset = await mediaAssetFixture();

    const pictured = await libraryStepFixture({
      content: { ...intro, image: { alt: "A heart", prompt: "A heart from the front" } },
      lessonId: lesson.id,
      mediaAssetId: asset.id,
      position: 0,
    });

    await signInProposer();

    const detach = await proposeFix({
      changes: [{ detachPicture: true, id: pictured.id, model: "Step" }],
      reason: "The picture shows the wrong organ.",
    });

    const { key } = await signInApprover();
    await approve({ fixId: detach.id, key });
    await signInProposer();

    const revert = await revertFix({ fixId: detach.id, reason: "It was the right picture." });

    expect(revert).toMatchObject({
      fix: {
        changes: [{ id: pictured.id, mediaAssetId: asset.id, op: "attachPicture" }],
        revertsId: detach.id,
      },
      status: "proposed",
    });

    const approver = await signInApprover();

    await expect(
      approve({ fixId: revert.status === "proposed" ? revert.fix.id : "", key: approver.key }),
    ).resolves.toMatchObject({ fix: { status: "applied" } });

    await expect(
      prisma.step.findUniqueOrThrow({ where: { id: pictured.id } }),
    ).resolves.toMatchObject({
      mediaAssetId: asset.id,
      pictureAvailableAt: expect.any(Date),
      pictureRemovedAt: null,
    });
  });

  it("puts a retired question back in practice, and ends stale once it's back already", async () => {
    const skill = await skillFixture();
    const item = await itemFixture({ format: "typed", skillId: skill.id });
    await signInProposer();

    const retire = await proposeFix({
      changes: [{ id: item.id, model: "Item", retire: true }],
      reason: "Its key is wrong.",
    });

    const { key } = await signInApprover();
    await approve({ fixId: retire.id, key });
    await signInProposer();

    const [first, second] = await Promise.all([
      revertFix({ fixId: retire.id, reason: "The key was right." }),
      revertFix({ fixId: retire.id, reason: "The key was right after all." }),
    ]);

    if (first.status !== "proposed" || second.status !== "proposed") {
      throw new Error(`Expected two reverts, got ${JSON.stringify([first, second])}`);
    }

    expect(first.fix.changes).toStrictEqual([{ id: item.id, model: "Item", op: "unretire" }]);

    const approver = await signInApprover();

    await expect(approve({ fixId: first.fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(prisma.item.findUniqueOrThrow({ where: { id: item.id } })).resolves.toMatchObject({
      retiredAt: null,
    });

    await expect(approve({ fixId: second.fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "stale" },
    });
  });
});

describe(proposeContentFixRevertInAdmin, () => {
  it("proposes the revert as the signed-in staff person, and refuses a learner", async () => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const { key, user } = await signInApprover();
    await approve({ fixId: fix.id, key });
    vi.mocked(headers).mockResolvedValue(new Headers());

    const revert = await revertInAdmin({ fixId: fix.id, reason: "Undo it." });

    expect(revert).toMatchObject({ fix: { revertsId: fix.id }, status: "proposed" });

    await expect(
      prisma.contentFix.findFirstOrThrow({ where: { revertsId: fix.id } }),
    ).resolves.toMatchObject({
      proposerClientId: "admin",
      proposerId: user.id,
      status: "proposed",
    });

    await expect(prisma.step.findUniqueOrThrow({ where: { id: check.id } })).resolves.toMatchObject(
      { content: { question: "What is 2 plus 2?" } },
    );

    const learner = await userFixture();
    mockSession(learner.id);

    await expect(revertInAdmin({ fixId: fix.id, reason: "Undo it." })).resolves.toStrictEqual({
      status: "forbidden",
    });
  });
});

describe("content fix approval regressions", () => {
  it.each(["item", "picture"] as const)(
    "an old %s restore cannot override a newer removal",
    async (kind) => {
      const skill = await skillFixture();
      const item = await itemFixture({ format: "typed", skillId: skill.id });
      const lesson = await libraryLessonFixture({ contentStatus: "completed" });
      const asset = await mediaAssetFixture();
      const step = await libraryStepFixture({ lessonId: lesson.id, mediaAssetId: asset.id });

      const changes =
        kind === "item"
          ? [{ id: item.id, model: "Item", retire: true }]
          : [{ detachPicture: true, id: step.id, model: "Step" }];

      await signInProposer();
      const removal = await proposeFix({ changes, reason: "First removal" });
      const approver = await signInApprover();
      await approve({ fixId: removal.id, key: approver.key });

      const oldRevert = await revertInAdmin({ fixId: removal.id, reason: "Undo first removal" });

      const immediate = await revertInAdmin({ fixId: removal.id, reason: "Restore now" });

      if (oldRevert.status !== "proposed" || immediate.status !== "proposed") {
        throw new Error("Expected proposals");
      }

      await approve({ fixId: immediate.fix.id, key: approver.key });
      await signInProposer();
      const newer = await proposeFix({ changes, reason: "Newly discovered error" });
      mockSession(approver.user.id);
      await approve({ fixId: newer.id, key: approver.key });

      const before =
        kind === "item"
          ? await prisma.item.findUniqueOrThrow({ where: { id: item.id } })
          : await prisma.step.findUniqueOrThrow({ where: { id: step.id } });

      await expect(approve({ fixId: oldRevert.fix.id, key: approver.key })).resolves.toMatchObject({
        fix: { status: "stale" },
      });

      const after =
        kind === "item"
          ? await prisma.item.findUniqueOrThrow({ where: { id: item.id } })
          : await prisma.step.findUniqueOrThrow({ where: { id: step.id } });

      expect(after).toStrictEqual(before);
    },
  );

  it("refuses approval options and approval from an impersonated staff session", async () => {
    const { lesson } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix({ changes: [rename(lesson.id, "Fixed title")], reason: "Typo" });
    const { user, key } = await signInApprover();
    const options = await optionsFor(fix.id);

    if (options.status !== "ready") {
      throw new Error("Expected options");
    }

    const session = await getSession();

    if (!session) {
      throw new Error("Expected session");
    }

    vi.mocked(getSession).mockResolvedValue({
      ...session,
      session: { ...session.session, impersonatedBy: user.id },
    });

    await expect(optionsFor(fix.id)).resolves.toStrictEqual({ status: "forbidden" });

    await expect(
      approveFix({
        assertion: signApproval({ challenge: options.options.challenge, key }),
        fixId: fix.id,
      }),
    ).resolves.toStrictEqual({ status: "forbidden" });

    await expect(
      prisma.contentFix.findUniqueOrThrow({ where: { id: fix.id } }),
    ).resolves.toMatchObject({ status: "proposed" });
  });
});

describe("stale removal reverts", () => {
  it.each(["item", "picture"] as const)(
    "an old pending revert of a %s restore cannot remove after a newer restore",
    async (kind) => {
      const skill = await skillFixture();
      const item = await itemFixture({ format: "typed", skillId: skill.id });
      const lesson = await libraryLessonFixture({ contentStatus: "completed" });
      const asset = await mediaAssetFixture();
      const step = await libraryStepFixture({ lessonId: lesson.id, mediaAssetId: asset.id });

      const changes =
        kind === "item"
          ? [{ id: item.id, model: "Item", retire: true }]
          : [{ detachPicture: true, id: step.id, model: "Step" }];

      const read = () =>
        kind === "item"
          ? prisma.item.findUniqueOrThrow({ select: { retiredAt: true }, where: { id: item.id } })
          : prisma.step.findUniqueOrThrow({
              select: { mediaAssetId: true },
              where: { id: step.id },
            });

      await signInProposer();
      const firstRemoval = await proposeFix({ changes, reason: "First removal" });
      const approver = await signInApprover();
      await approve({ fixId: firstRemoval.id, key: approver.key });

      const firstRestore = await revertInAdmin({
        fixId: firstRemoval.id,
        reason: "Undo first removal",
      });

      if (firstRestore.status !== "proposed") {
        throw new Error("Expected restore");
      }

      await approve({ fixId: firstRestore.fix.id, key: approver.key });

      const oldUndoOfRestore = await revertInAdmin({
        fixId: firstRestore.fix.id,
        reason: "Undo the first restore",
      });

      if (oldUndoOfRestore.status !== "proposed") {
        throw new Error(`Expected old undo, got ${JSON.stringify(oldUndoOfRestore)}`);
      }

      await signInProposer();
      const newerRemoval = await proposeFix({ changes, reason: "Newer removal" });
      mockSession(approver.user.id);
      await approve({ fixId: newerRemoval.id, key: approver.key });

      const newerRestore = await revertInAdmin({
        fixId: newerRemoval.id,
        reason: "Newer removal was a mistake; keep it",
      });

      if (newerRestore.status !== "proposed") {
        throw new Error("Expected newer restore");
      }

      await approve({ fixId: newerRestore.fix.id, key: approver.key });

      const before = await read();

      expect(before).toStrictEqual(
        kind === "item" ? { retiredAt: null } : { mediaAssetId: asset.id },
      );

      const result = await approve({ fixId: oldUndoOfRestore.fix.id, key: approver.key });
      const after = await read();

      expect(result).toMatchObject({ fix: { status: "stale" } });
      expect(after).toStrictEqual(before);
    },
  );

  it("reverts a fix after a later fix changed other parts of the same rows", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "completed" });
    const asset = await mediaAssetFixture();

    const step = await libraryStepFixture({
      content: intro,
      lessonId: lesson.id,
      mediaAssetId: asset.id,
    });

    await signInProposer();
    const title = await proposeFix({ changes: [rename(lesson.id, "New title")], reason: "Title" });

    const detach = await proposeFix({
      changes: [{ detachPicture: true, id: step.id, model: "Step" }],
      reason: "Wrong picture",
    });

    const approver = await signInApprover();
    await approve({ fixId: title.id, key: approver.key });
    await approve({ fixId: detach.id, key: approver.key });

    await signInProposer();

    const later = await proposeFix({
      changes: [
        { id: lesson.id, model: "Lesson", set: { description: "New description" } },
        { id: step.id, model: "Step", set: { content: { ...intro, title: "Addition" } } },
      ],
      reason: "Description and typo",
    });

    mockSession(approver.user.id);
    await approve({ fixId: later.id, key: approver.key });

    const undoTitle = await revertInAdmin({ fixId: title.id, reason: "Undo" });
    const undoDetach = await revertInAdmin({ fixId: detach.id, reason: "Undo" });

    if (undoTitle.status !== "proposed" || undoDetach.status !== "proposed") {
      throw new Error("Expected both reverts to be proposed");
    }

    await expect(approve({ fixId: undoTitle.fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(approve({ fixId: undoDetach.fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(
      Promise.all([
        prisma.lesson.findUniqueOrThrow({
          select: { description: true, title: true },
          where: { id: lesson.id },
        }),
        prisma.step.findUniqueOrThrow({ select: { mediaAssetId: true }, where: { id: step.id } }),
      ]),
    ).resolves.toStrictEqual([
      { description: "New description", title: lesson.title },
      { mediaAssetId: asset.id },
    ]);
  });

  it("refuses a revert once a later fix rewrote what it would put back", async () => {
    const skill = await skillFixture();
    const item = await itemFixture({ format: "typed", skillId: skill.id });
    const changes = [{ id: item.id, model: "Item", retire: true }];

    await signInProposer();
    const removal = await proposeFix({ changes, reason: "Wrong question" });
    const approver = await signInApprover();
    await approve({ fixId: removal.id, key: approver.key });

    const restore = await revertInAdmin({ fixId: removal.id, reason: "Undo" });

    if (restore.status !== "proposed") {
      throw new Error("Expected restore");
    }

    await approve({ fixId: restore.fix.id, key: approver.key });

    await signInProposer();
    const newerRemoval = await proposeFix({ changes, reason: "Still wrong" });
    mockSession(approver.user.id);
    await approve({ fixId: newerRemoval.id, key: approver.key });

    const late = await revertInAdmin({ fixId: removal.id, reason: "Old undo" });

    if (late.status !== "proposed") {
      throw new Error("Expected late revert");
    }

    const before = await prisma.item.findUniqueOrThrow({
      select: { retiredAt: true },
      where: { id: item.id },
    });

    await expect(approve({ fixId: late.fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "stale" },
    });

    await expect(
      prisma.item.findUniqueOrThrow({ select: { retiredAt: true }, where: { id: item.id } }),
    ).resolves.toStrictEqual(before);
  });
});

describe("course descriptions", () => {
  it("reverts a description added to a course that had none", async () => {
    const course = await courseFixture({ description: null });

    await signInProposer();

    const added = await proposeFix({
      changes: [{ id: course.id, model: "Course", set: { description: "Learn the basics." } }],
      reason: "The course had no description",
    });

    const approver = await signInApprover();
    await approve({ fixId: added.id, key: approver.key });

    const undo = await revertInAdmin({ fixId: added.id, reason: "Undo" });

    if (undo.status !== "proposed") {
      throw new Error(`Expected a revert, got ${JSON.stringify(undo)}`);
    }

    await expect(approve({ fixId: undo.fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(
      prisma.course.findUniqueOrThrow({ select: { description: true }, where: { id: course.id } }),
    ).resolves.toStrictEqual({ description: null });
  });
});
