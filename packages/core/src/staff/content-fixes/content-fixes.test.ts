import { randomUUID } from "node:crypto";
import { STAFF_PROPOSE_SCOPE, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { type Step, prisma } from "@zoonk/db";
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
import {
  approveContentFix,
  getContentFixApprovalOptions,
  rejectContentFix,
} from "./decide-content-fix";
import { proposeContentFix, proposeContentFixRevert } from "./propose-content-fix";

const PROPOSE_SCOPES = [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE, "offline_access"];

const intro = { text: "Two and two make four.", title: "Adding" };

const question = {
  basis: { position: 0, quote: "Two and two make four." },
  options: [
    { id: "a", isCorrect: true, reason: "Two and two make four.", text: "4" },
    { id: "b", isCorrect: false, reason: "That's two and three.", text: "5" },
  ],
  question: "What is 2 + 2?",
};

async function signInProposer(scopes = PROPOSE_SCOPES) {
  const user = await userFixture({ role: "admin" });
  const { accessToken } = await cliTokenFixture({ scopes, user });
  vi.mocked(headers).mockResolvedValue(new Headers({ authorization: `Bearer ${accessToken}` }));
  return user;
}

async function signInApprover() {
  const user = await userFixture({ role: "admin" });
  const key = await passkeyFixture(user.id);
  mockSession(user.id);
  return { key, user };
}

async function publishedLesson() {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });

  const [reading, check] = await Promise.all([
    libraryStepFixture({ content: intro, lessonId: lesson.id, position: 0 }),
    libraryStepFixture({ content: question, kind: "check", lessonId: lesson.id, position: 1 }),
  ]);

  return { check, lesson, reading };
}

function fixedQuestion(step: Pick<Step, "id">) {
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

function rename(id: string, title: string) {
  return { id, model: "Lesson", set: { title } };
}

async function proposeFix(input: unknown) {
  const result = await proposeContentFix(input);

  if (result.status !== "proposed") {
    throw new Error(`Expected a proposal, got ${JSON.stringify(result)}`);
  }

  return result.fix;
}

async function approve({
  fixId,
  key,
}: {
  fixId: string;
  key: Awaited<ReturnType<typeof passkeyFixture>>;
}) {
  const options = await getContentFixApprovalOptions(fixId);

  if (options.status !== "ready") {
    throw new Error(`Expected approval options, got ${JSON.stringify(options)}`);
  }

  return approveContentFix({
    assertion: signApproval({ challenge: options.options.challenge, key }),
    fixId,
  });
}

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

describe(approveContentFix, () => {
  it("applies exactly the stored change once a staff passkey signs this fix's challenge", async () => {
    const { check, lesson } = await publishedLesson();
    await answerExplanationFixture({ stepId: check.id });
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const { key, user } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toStrictEqual({
      cacheNotified: true,
      fix: { id: fix.id, staleReason: null, status: "applied" },
      status: "decided",
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
      approveContentFix({ assertion: signApproval({ challenge: "used", key }), fixId: fix.id }),
    ).resolves.toMatchObject({
      cacheNotified: null,
      fix: { status: "applied" },
      status: "decided",
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
    const options = await getContentFixApprovalOptions(fix.id);

    if (options.status !== "ready") {
      throw new Error("Expected approval options");
    }

    const assertion = signApproval({ challenge: options.options.challenge, key });

    const results = await Promise.all([
      approveContentFix({ assertion, fixId: fix.id }),
      approveContentFix({ assertion, fixId: fix.id }),
    ]);

    expect(results.map((result) => result.status === "decided" && result.fix.status)).toStrictEqual(
      ["applied", "applied"],
    );

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
    const options = await getContentFixApprovalOptions(fix.id);

    if (options.status !== "ready") {
      throw new Error("Expected approval options");
    }

    await expect(
      approveContentFix({
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
    const options = await getContentFixApprovalOptions(fix.id);

    if (options.status !== "ready") {
      throw new Error("Expected approval options");
    }

    await expect(
      approveContentFix({
        assertion: signApproval({ challenge: options.options.challenge, key: othersKey }),
        fixId: fix.id,
      }),
    ).resolves.toStrictEqual({ status: "assertionInvalid" });

    const withoutPasskey = await userFixture({ role: "admin" });
    mockSession(withoutPasskey.id);

    await expect(getContentFixApprovalOptions(fix.id)).resolves.toStrictEqual({
      status: "needsPasskey",
    });
  });

  it("refuses a learner's session and a missing session", async () => {
    const { check } = await publishedLesson();
    await signInProposer();
    const fix = await proposeFix(fixedQuestion(check));
    const learner = await userFixture();

    mockSession(learner.id);

    await expect(getContentFixApprovalOptions(fix.id)).resolves.toStrictEqual({
      status: "forbidden",
    });

    mockSession(null);
    await expect(rejectContentFix(fix.id)).resolves.toStrictEqual({ status: "unauthorized" });
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

    await expect(rejectContentFix(fix.id)).resolves.toMatchObject({
      fix: { status: "rejected" },
      status: "decided",
    });

    await expect(
      approveContentFix({ assertion: signApproval({ challenge: "any", key }), fixId: fix.id }),
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

    const revert = await proposeContentFixRevert({
      fixId: fix.id,
      reason: "The old wording tested better.",
    });

    expect(revert).toMatchObject({
      fix: {
        changes: [{ fields: [{ after: question, field: "content" }], id: check.id }],
        revertsId: fix.id,
        status: "proposed",
      },
      status: "proposed",
    });

    await expect(
      proposeContentFixRevert({ fixId: randomUUID(), reason: "Undo." }),
    ).resolves.toMatchObject({ status: "notFound" });
  });
});
