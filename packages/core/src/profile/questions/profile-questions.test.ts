import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { getUsageRule } from "../../entitlements/limits";
import { listFollowUps } from "../../follow-ups/follow-up-rows";
import { LEARNER_CONFIDENCE } from "../../memory/_utils/memory-candidates";
import { deleteMemoryFact } from "../../memory/delete-memory-fact";
import { undoMemoryChanges } from "../../memory/undo-memory-changes";
import { updateMemoryFact } from "../../memory/update-memory-fact";
import { exportCurrentUserData } from "../../users/export-current-user-data";
import { answerOnboardingQuestion } from "../../view-models/onboarding/answer-onboarding-question";
import { getOnboarding } from "../../view-models/onboarding/get-onboarding";
import {
  getOnboardingSteps,
  hasOnboardingQuestions,
} from "../../view-models/onboarding/onboarding-steps";
import { answerProfileQuestion } from "./answer-profile-question";
import { getProfileQuestions } from "./get-profile-questions";
import { PROFILE_QUESTIONS, profileAnswerInputSchema } from "./profile-question-contract";
import { skipProfileQuestions } from "./skip-profile-questions";

async function learner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

function save(input: unknown, locale: "en" | "ja" | "pt" = "en") {
  return answerProfileQuestion({ input: profileAnswerInputSchema.parse(input), locale });
}

const watch = {
  answer: { favorites: "Star Trek; Fringe; star trek", picks: ["anime", "sciFi"] },
  question: "watch",
};

const activeFacts = (userId: string) =>
  prisma.memoryFact.findMany({ where: { status: "active", userId } });

describe("profile question capabilities", () => {
  it("requires a session for reads, saves and skips", async () => {
    mockSession(null);
    await expect(getProfileQuestions({ locale: "en" })).resolves.toBeNull();
    await expect(save(watch)).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(
      skipProfileQuestions({ goalId: crypto.randomUUID(), questions: ["work"] }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("creates authoritative facts, replaces them, and makes a resend a write-free result", async () => {
    const user = await learner();
    const goal = await goalFixture({ userId: user.id });
    await planFixture({ goalId: goal.id });

    await expect(save(watch)).resolves.toMatchObject({
      question: {
        saved: { picks: ["anime", "sciFi"], text: "Star Trek, Fringe" },
        status: "answered",
      },
      status: "saved",
    });

    const facts = await activeFacts(user.id);
    expect(facts).toHaveLength(1);

    expect(facts[0]).toMatchObject({
      category: "context",
      confidence: LEARNER_CONFIDENCE,
      origin: "said",
      profileAnswer: { favorites: ["Star Trek", "Fringe"], picks: ["anime", "sciFi"] },
      sensitive: true,
      sourceRef: { id: "watch", kind: "profile" },
    });

    await expect(listFollowUps(user.id)).resolves.toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "checkFactSensitivity" })]),
    );

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    vi.mocked(revalidateTag).mockClear();

    const repeat = await countDatabaseStatements(() =>
      save({
        answer: { favorites: "Star Trek, Fringe", picks: ["sciFi", "anime", "sciFi"] },
        question: "watch",
      }),
    );

    expect(repeat.writes).toBe(0);
    expect(revalidateTag).not.toHaveBeenCalled();

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);

    await save({ answer: { picks: ["comedy"] }, question: "watch" });

    await expect(activeFacts(user.id)).resolves.toStrictEqual([
      expect.objectContaining({ sensitive: false, statement: "Watches comedy" }),
    ]);

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: facts[0]!.id } }),
    ).resolves.toMatchObject({ deletedAt: expect.any(Date), status: "superseded" });
  });

  it.each(PROFILE_QUESTIONS)(
    "accepts a decline without nested answer fields: %s",
    async (question) => {
      const user = await learner();

      await expect(save({ answer: { declined: true }, question })).resolves.toMatchObject({
        question: { status: "declined" },
        status: "saved",
      });

      await expect(activeFacts(user.id)).resolves.toStrictEqual([]);
    },
  );

  it("keeps conditions consent-only, replaces the whole set and normalizes duplicate ids", async () => {
    const user = await learner();

    const input = {
      answer: {
        conditions: [
          { condition: "adhd", note: "discard" },
          { condition: "adhd" },
          { condition: "other", note: " Needs a pause " },
        ],
      },
      question: "conditions",
    };

    await expect(save(input)).resolves.toStrictEqual({ status: "consentRequired" });
    await expect(prisma.learnerCondition.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      save({ ...input, answer: { ...input.answer, consented: true } }),
    ).resolves.toMatchObject({
      question: { saved: { picks: ["adhd", "other"], text: "Needs a pause" } },
      status: "saved",
    });

    await expect(
      prisma.learnerCondition.findMany({ where: { userId: user.id } }),
    ).resolves.toHaveLength(2);

    await expect(activeFacts(user.id)).resolves.toStrictEqual([]);

    await save({
      answer: { conditions: [{ condition: "autism" }], consented: true },
      question: "conditions",
    });

    await expect(
      prisma.learnerCondition.findMany({ where: { userId: user.id } }),
    ).resolves.toStrictEqual([expect.objectContaining({ condition: "autism", note: null })]);

    await save({ answer: { declined: true }, question: "conditions" });
    await expect(prisma.learnerCondition.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("gates biography on memory and keeps support settings editable without changing facts", async () => {
    const user = await learner();
    await learningProfileFixture({ memoryEnabled: false, userId: user.id });
    const blocked = await countDatabaseStatements(() => save(watch));
    expect(blocked.result).toStrictEqual({ status: "memoryOff" });
    expect(blocked.writes).toBe(0);

    await expect(
      save({
        answer: {
          needs: ["stepByStep", "stepByStep"],
          note: "Do not save this",
          soundEffects: false,
        },
        question: "learningSupport",
      }),
    ).resolves.toMatchObject({ status: "saved" });

    await expect(activeFacts(user.id)).resolves.toStrictEqual([]);

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({
      learningNeeds: ["stepByStep"],
      memoryEnabled: false,
      soundsEnabled: false,
    });
  });

  it("treats sound-only as an answer, preserves omitted sounds, and clears declined needs", async () => {
    const user = await learner();

    await expect(
      save({ answer: { soundEffects: false }, question: "learningSupport" }),
    ).resolves.toMatchObject({ status: "saved" });

    await save({ answer: { needs: ["plainWords"] }, question: "learningSupport" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ learningNeeds: ["plainWords"], soundsEnabled: false });

    await save({ answer: { declined: true, soundEffects: true }, question: "learningSupport" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ learningNeeds: [], soundsEnabled: true });
  });

  it.each(["en", "ja"] as const)(
    "saves a 300-character support note as one statement in %s",
    async (locale) => {
      const user = await learner();
      const note = (locale === "ja" ? "文" : "a").repeat(300);

      await expect(
        save({ answer: { note }, question: "learningSupport" }, locale),
      ).resolves.toMatchObject({ status: "saved" });

      await expect(activeFacts(user.id)).resolves.toStrictEqual([
        expect.objectContaining({
          category: "learning",
          profileAnswer: { note },
          sensitive: true,
          statement: note,
        }),
      ]);
    },
  );

  it("owes sensitivity checks only with an admitted assist", async () => {
    const user = await learner();

    await usageRecordsFixture({
      count: getUsageRule({ kind: "assist", tier: "free" }).day ?? 0,
      createdAt: new Date(),
      kind: "assist",
      userId: user.id,
    });

    await save(watch);
    const facts = await activeFacts(user.id);
    expect(facts[0]?.sensitive).toBe(true);
    await expect(listFollowUps(user.id)).resolves.toStrictEqual([]);
  });

  it("admits only the remaining assist when several typed studies are saved together", async () => {
    const user = await learner();
    const cap = getUsageRule({ kind: "assist", tier: "free" }).day ?? 0;

    await usageRecordsFixture({
      count: cap - 1,
      createdAt: new Date(),
      kind: "assist",
      userId: user.id,
    });

    await save({
      answer: {
        studies: [
          { field: "computing", subject: "CS" },
          { field: "media", subject: "Journalism" },
          { field: "business", subject: "Finance" },
        ],
      },
      question: "studies",
    });

    const claims = await prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } });
    expect(claims).toBe(cap);
    const checks = await listFollowUps(user.id);
    expect(checks).toHaveLength(1);
    await expect(activeFacts(user.id)).resolves.toHaveLength(3);
  });

  it.each([
    { answer: { studies: [{ field: "other" }] }, question: "studies" },
    { answer: { conditions: [{ condition: "other" }], consented: true }, question: "conditions" },
    { answer: { declined: true, picks: ["anime"] }, question: "watch" },
  ])("rejects invalid semantic answers without writes: %j", async (input) => {
    await learner();
    const result = await countDatabaseStatements(() => save(input));
    expect(result.result).toStrictEqual({ status: "invalid" });
    expect(result.writes).toBe(0);
  });

  it("clears structured data on reword, and a deleted answered fact never equals a decline", async () => {
    const user = await learner();
    await save({ answer: { job: "nurse", status: "work" }, question: "work" });
    const [fact] = await activeFacts(user.id);
    await updateMemoryFact({ factId: fact!.id, input: { statement: "Works nights" } });

    await expect(
      prisma.memoryFact.findUniqueOrThrow({ where: { id: fact!.id } }),
    ).resolves.toMatchObject({ profileAnswer: null, statement: "Works nights" });

    const profile = await getProfileQuestions({ locale: "en" });

    expect(profile?.questions.find((question) => question.id === "work")?.saved).toStrictEqual({
      picks: [],
      studies: [],
      text: "",
    });

    await deleteMemoryFact(fact!.id);

    await expect(save({ answer: { declined: true }, question: "work" })).resolves.toMatchObject({
      question: { status: "declined" },
      status: "saved",
    });

    await expect(
      prisma.profileAnswer.findUniqueOrThrow({
        where: { userId_question: { question: "work", userId: user.id } },
      }),
    ).resolves.toMatchObject({ outcome: "declined" });
  });

  it("removes only a deleted study from prefill and restores it on undo", async () => {
    const user = await learner();

    await save({
      answer: { studies: [{ field: "media", subject: "Journalism" }, { field: "computing" }] },
      question: "studies",
    });

    const facts = await activeFacts(user.id);
    const media = facts.find((fact) => fact.statement === "Studied Journalism")!;
    const removed = await deleteMemoryFact(media.id);
    expect(removed.status).toBe("deleted");

    const afterDelete = await getProfileQuestions({ locale: "en" });

    expect(
      afterDelete?.questions.find((question) => question.id === "studies")?.saved.studies,
    ).toStrictEqual([{ field: "computing", subject: null }]);

    await undoMemoryChanges({ changes: [{ factId: null, previousFactId: media.id }] });

    const afterUndo = await getProfileQuestions({ locale: "en" });

    expect(
      afterUndo?.questions.find((question) => question.id === "studies")?.saved.studies,
    ).toStrictEqual([
      { field: "computing", subject: null },
      { field: "media", subject: "Journalism" },
    ]);
  });

  it("keeps an unchanged cleared support note when needs or sounds change", async () => {
    const user = await learner();
    const note = "Diagrams help me";

    await save({
      answer: { needs: ["stepByStep"], note, soundEffects: true },
      question: "learningSupport",
    });

    const [original] = await activeFacts(user.id);
    await prisma.memoryFact.update({ data: { sensitive: false }, where: { id: original!.id } });

    await save({
      answer: { needs: ["shortAnswers"], note, soundEffects: true },
      question: "learningSupport",
    });

    await save({
      answer: { needs: ["shortAnswers"], note, soundEffects: false },
      question: "learningSupport",
    });

    await expect(activeFacts(user.id)).resolves.toMatchObject([
      { id: original!.id, sensitive: false, statement: note },
    ]);

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);

    await expect(listFollowUps(user.id)).resolves.toHaveLength(1);
  });

  it("keeps cleared studies and spends no assists for them when another study is added at the cap", async () => {
    const user = await learner();

    const studies = [
      { field: "computing", subject: "Computer science" },
      { field: "media", subject: "Journalism" },
    ];

    await save({ answer: { studies }, question: "studies" });
    const originals = await activeFacts(user.id);
    await prisma.memoryFact.updateMany({ data: { sensitive: false }, where: { userId: user.id } });
    const cap = getUsageRule({ kind: "assist", tier: "free" }).day ?? 0;

    await usageRecordsFixture({
      count: cap - 2,
      createdAt: new Date(),
      kind: "assist",
      userId: user.id,
    });

    await save({
      answer: { studies: [...studies, { field: "business", subject: "Finance" }] },
      question: "studies",
    });

    const current = await activeFacts(user.id);
    expect(current).toHaveLength(3);

    expect(
      current
        .filter((fact) => originals.some((original) => original.id === fact.id))
        .every((fact) => !fact.sensitive),
    ).toBe(true);

    expect(
      current.filter((fact) => originals.some((original) => original.id === fact.id)),
    ).toHaveLength(2);

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(cap);

    await expect(listFollowUps(user.id)).resolves.toHaveLength(2);
  });

  it("round-trips accepted Japanese favorites with canonical separators", async () => {
    await learner();
    const items = Array.from({ length: 11 }, (_, index) => `ドラゴンボール${index}`);
    const favorites = items.join("、");
    expect(favorites.length).toBeLessThanOrEqual(120);
    const saved = await save({ answer: { favorites }, question: "watch" }, "ja");

    if (saved.status !== "saved") {
      throw new Error(saved.status);
    }

    expect(saved.question.saved.text).toBe(items.join(", "));
    expect(saved.question.saved.text.length).toBeLessThanOrEqual(120);

    const repeat = await countDatabaseStatements(() =>
      save({ answer: { favorites: saved.question.saved.text }, question: "watch" }, "ja"),
    );

    expect(repeat.result).toMatchObject({ status: "saved" });
    expect(repeat.writes).toBe(0);
  });

  it("refuses a note-only support answer with memory off before recording it as answered", async () => {
    const user = await learner();
    await learningProfileFixture({ memoryEnabled: false, userId: user.id });

    const result = await countDatabaseStatements(() =>
      save({ answer: { note: "Diagrams help" }, question: "learningSupport" }),
    );

    expect(result.result).toStrictEqual({ status: "invalid" });
    expect(result.writes).toBe(0);
    await expect(prisma.profileAnswer.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("refuses an old deletion's undo after a newer answer, including a decline", async () => {
    const user = await learner();
    await save({ answer: { picks: ["anime"] }, question: "watch" });
    const [old] = await activeFacts(user.id);
    await save({ answer: { picks: ["comedy"] }, question: "watch" });

    await expect(
      undoMemoryChanges({ changes: [{ factId: null, previousFactId: old!.id }] }),
    ).resolves.toMatchObject({ status: "conflict" });

    const [current] = await activeFacts(user.id);
    await save({ answer: { declined: true }, question: "watch" });

    await expect(
      undoMemoryChanges({ changes: [{ factId: null, previousFactId: current!.id }] }),
    ).resolves.toMatchObject({ status: "conflict" });

    await expect(activeFacts(user.id)).resolves.toStrictEqual([]);
  });

  it("does not restore a manually deleted study after About you replaces that question", async () => {
    const user = await learner();

    await save({
      answer: { studies: [{ field: "media", subject: "Journalism" }] },
      question: "studies",
    });

    const [old] = await activeFacts(user.id);
    await deleteMemoryFact(old!.id);

    await save({
      answer: { studies: [{ field: "computing" }, { field: "business" }, { field: "law" }] },
      question: "studies",
    });

    await expect(
      undoMemoryChanges({ changes: [{ factId: null, previousFactId: old!.id }] }),
    ).resolves.toMatchObject({ status: "conflict" });

    const view = await getProfileQuestions({ locale: "en" });

    expect(
      view?.questions.find((question) => question.id === "studies")?.saved.studies,
    ).toHaveLength(3);
  });

  it.each([
    { labels: ["Novelas"], picks: ["novelas"], question: "watch", unselected: "kDramas" },
    {
      labels: ["Funk", "Sertanejo"],
      picks: ["funk", "sertanejo"],
      question: "listen",
      unselected: "reggaeton",
    },
  ])(
    "keeps saved Portuguese $question options selectable in English",
    async ({ labels, picks, question, unselected }) => {
      await learner();
      await save({ answer: { picks }, question }, "pt");
      const view = await getProfileQuestions({ locale: "en" });
      const saved = view?.questions.find((item) => item.id === question);

      expect(saved?.status).toBe("answered");
      expect(saved?.saved.picks).toStrictEqual(picks);

      expect(
        saved?.saved.picks.map((id) => saved.options.find((option) => option.id === id)?.label),
      ).toStrictEqual(labels);

      expect(saved?.options.some((option) => option.id === unselected)).toBe(false);
      expect(new Set(saved?.options.map((option) => option.id)).size).toBe(saved?.options.length);
    },
  );

  it("exports structured facts, status records, needs and consented conditions", async () => {
    await learner();
    await save(watch);
    await save({ answer: { needs: ["plainWords"] }, question: "learningSupport" });

    await save({
      answer: { conditions: [{ condition: "adhd" }], consented: true },
      question: "conditions",
    });

    const exported = await exportCurrentUserData();

    expect(exported).toMatchObject({
      conditions: [expect.objectContaining({ condition: "adhd" })],
      learningNeeds: ["plainWords"],
      memory: {
        facts: [
          expect.objectContaining({
            profileAnswer: { favorites: ["Star Trek", "Fringe"], picks: ["anime", "sciFi"] },
          }),
        ],
      },
    });

    expect(exported?.profileAnswers).toHaveLength(3);
  });
});

describe("profile saves under contention", () => {
  it.each([true, false])(
    "serializes genuinely concurrent saves (identical: %s)",
    async (identical) => {
      const user = await learner();
      const lock = holdLearnerLock({ userId: user.id });
      const pid = await lock.pid;
      const first = save(watch);
      await waitForBlockedStatement(pid, LEARNER_LOCK);

      const second = save(
        identical ? watch : { answer: { favorites: "Comedy" }, question: "watch" },
      );

      const results = Promise.allSettled([first, second]);

      try {
        await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
      } finally {
        lock.release();
        await lock.done;
      }

      await expect(results).resolves.toStrictEqual([
        expect.objectContaining({
          status: "fulfilled",
          value: expect.objectContaining({ status: "saved" }),
        }),
        expect.objectContaining({
          status: "fulfilled",
          value: expect.objectContaining({ status: "saved" }),
        }),
      ]);

      const facts = await activeFacts(user.id);
      expect(facts).toHaveLength(1);

      expect(facts[0]?.statement).toBe(
        identical
          ? "Watches anime and sci-fi and fantasy, especially Star Trek and Fringe"
          : "Watches Comedy",
      );

      await expect(
        prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
      ).resolves.toBe(identical ? 1 : 2);
    },
  );
});

describe("profile onboarding", () => {
  it("places profile before buddy without making optional questions setup still owed", () => {
    const steps = getOnboardingSteps({
      goal: { details: {}, kind: "learn", replacesGoalId: null, targetDate: null },
      profile: { hasBuddy: false, hasEarlierGoals: false },
      profileSteps: ["work", "tools"],
    });

    expect(steps.indexOf("work")).toBeLessThan(steps.indexOf("buddy"));
    expect(hasOnboardingQuestions(["work", "conditions", "plan"])).toBe(false);
  });

  it("skips every goal typed together and asks again on the next goal", async () => {
    const user = await learner();
    const onboardingId = crypto.randomUUID();

    const goals = await Promise.all([
      goalFixture({ details: { onboardingId }, userId: user.id }),
      goalFixture({ details: { onboardingId }, userId: user.id }),
    ]);

    await expect(
      answerOnboardingQuestion({
        goalId: goals[0]!.id,
        input: { answer: null, question: "tools" },
      }),
    ).resolves.toMatchObject({ status: "saved" });

    const saved = await prisma.goal.findMany({
      where: { id: { in: goals.map((goal) => goal.id) } },
    });

    expect(saved.every((goal) => JSON.stringify(goal.details).includes('"tools"'))).toBe(true);
    const next = await goalFixture({ planRevealedAt: null, userId: user.id });
    const view = await getOnboarding({ goalId: next.id, locale: "pt" });

    expect(view).toMatchObject({
      onboarding: { profile: { memoryEnabled: true, questions: expect.any(Array) } },
      status: "ready",
    });

    if (view.status !== "ready") {
      throw new Error(view.status);
    }

    expect(view.onboarding.steps).toContain("tools");

    expect(
      view.onboarding.profile.questions.find((question) => question.id === "tools")?.status,
    ).toBeNull();
  });

  it("Don't ask again declines only unanswered questions and leaves all saved data intact", async () => {
    const user = await learner();
    const goal = await goalFixture({ userId: user.id });
    await save(watch);
    const before = await activeFacts(user.id);

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { forever: true, question: "skipProfile" },
    });

    await expect(activeFacts(user.id)).resolves.toStrictEqual(before);
    await expect(prisma.learnerCondition.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();

    await expect(
      prisma.profileAnswer.findMany({ where: { userId: user.id } }),
    ).resolves.toHaveLength(10);

    const next = await goalFixture({ planRevealedAt: null, userId: user.id });
    const view = await getOnboarding({ goalId: next.id });

    if (view.status !== "ready") {
      throw new Error(view.status);
    }

    expect(
      view.onboarding.steps.filter((step) => PROFILE_QUESTIONS.some((id) => id === step)),
    ).toStrictEqual([]);
  });
});
