import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { trackServerEvent } from "../../analytics/server";
import { answerOnboardingQuestion } from "../../view-models/onboarding/answer-onboarding-question";
import { answerProfileQuestion } from "./answer-profile-question";
import { profileAnswerInputSchema } from "./profile-question-contract";

async function learner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

function events(name: string) {
  return vi
    .mocked(trackServerEvent)
    .mock.calls.map(([event]) => event)
    .filter((event) => event.name === name);
}

function save(input: unknown) {
  return answerProfileQuestion({ input: profileAnswerInputSchema.parse(input), locale: "en" });
}

const CASES = [
  {
    input: {
      answer: { favorites: "PRIVATE favorite", picks: ["sciFi", "anime", "anime"] },
      question: "watch",
    },
    properties: { options: ["anime", "sciFi"], picks: 2, typedText: true },
  },
  {
    input: { answer: { picks: ["podcasts"] }, question: "listen" },
    properties: { options: ["podcasts"], picks: 1, typedText: false },
  },
  {
    input: { answer: { picks: ["soccer"] }, question: "play" },
    properties: { options: ["soccer"], picks: 1, typedText: false },
  },
  {
    input: { answer: { picks: ["newsPolitics"] }, question: "read" },
    properties: { options: ["newsPolitics"], picks: 1, typedText: false },
  },
  {
    input: { answer: { picks: ["cook"] }, question: "activities" },
    properties: { options: ["cook"], picks: 1, typedText: false },
  },
  {
    input: { answer: { favorites: "PRIVATE tool", picks: ["figma"] }, question: "tools" },
    properties: { options: ["figma"], picks: 1, typedText: true },
  },
  {
    input: {
      answer: { studies: [{ field: "media", subject: "PRIVATE subject" }, { field: "business" }] },
      question: "studies",
    },
    properties: { options: ["business", "media"], picks: 2, typedText: true },
  },
  {
    input: { answer: { job: "PRIVATE job", status: "work" }, question: "work" },
    properties: { picks: 1, typedText: true },
  },
] as const;

describe("profile write analytics", () => {
  it.each(CASES)(
    "sends only counts and allowed option ids for $input.question in settings",
    async ({ input, properties }) => {
      const user = await learner();
      const flush = runDeferredWork();

      await expect(
        answerProfileQuestion({ input: profileAnswerInputSchema.parse(input), locale: "en" }),
      ).resolves.toMatchObject({ status: "saved" });

      await flush();

      expect(events("Profile Question Saved")).toStrictEqual([
        expect.objectContaining({
          distinctId: user.id,
          properties: {
            from: "settings",
            outcome: "answered",
            question: input.question,
            ...properties,
          },
        }),
      ]);

      expect(JSON.stringify(vi.mocked(trackServerEvent).mock.calls)).not.toContain("PRIVATE");
      expect(events("Onboarding Progressed")).toStrictEqual([]);
    },
  );

  it.each([
    {
      input: {
        answer: {
          conditions: [{ condition: "other", note: "PRIVATE condition" }],
          consented: true,
        },
        question: "conditions",
      },
      properties: { question: "conditions" },
    },
    {
      input: { answer: { declined: true }, question: "conditions" },
      properties: { question: "conditions" },
    },
    {
      input: {
        answer: { needs: ["shorterDays"], note: "PRIVATE support", soundEffects: false },
        question: "learningSupport",
      },
      properties: { outcome: "answered", question: "learningSupport" },
    },
  ])("omits sensitive answer details from $input.question", async ({ input, properties }) => {
    await learner();
    const flush = runDeferredWork();
    await answerProfileQuestion({ input: profileAnswerInputSchema.parse(input), locale: "en" });
    await flush();

    expect(events("Profile Question Saved")).toStrictEqual([
      expect.objectContaining({ properties: { from: "settings", ...properties } }),
    ]);

    expect(JSON.stringify(vi.mocked(trackServerEvent).mock.calls)).not.toMatch(
      /PRIVATE|shorterDays|noSoundEffects/u,
    );
  });

  it("tracks an onboarding decline and its question once across resends", async () => {
    const user = await learner();
    const goal = await goalFixture({ planRevealedAt: null, userId: user.id });
    const flush = runDeferredWork();

    const request = {
      goalId: goal.id,
      input: profileAnswerInputSchema.parse({ answer: { declined: true }, question: "watch" }),
    } as const;

    await answerOnboardingQuestion(request);
    await answerOnboardingQuestion(request);
    await flush();

    expect(events("Profile Question Saved")).toStrictEqual([
      expect.objectContaining({
        properties: {
          from: "onboarding",
          options: [],
          outcome: "declined",
          picks: 0,
          question: "watch",
          typedText: false,
        },
      }),
    ]);

    expect(events("Onboarding Progressed")).toStrictEqual([
      expect.objectContaining({
        properties: expect.objectContaining({
          goal_id: goal.id,
          question: "watch",
          stage: "question_answered",
        }),
      }),
    ]);
  });

  it("tracks a single skip once without counting it as Skip all", async () => {
    const user = await learner();
    const goal = await goalFixture({ planRevealedAt: null, userId: user.id });
    const flush = runDeferredWork();
    const request = { goalId: goal.id, input: { answer: null, question: "tools" } } as const;
    await answerOnboardingQuestion(request);
    await answerOnboardingQuestion(request);
    await flush();

    expect(events("Profile Question Saved")).toStrictEqual([
      expect.objectContaining({
        properties: {
          from: "onboarding",
          options: [],
          outcome: "skipped",
          picks: 0,
          question: "tools",
          typedText: false,
        },
      }),
    ]);

    expect(events("Profile Questions Skipped")).toStrictEqual([]);
    expect(events("Onboarding Progressed")).toHaveLength(1);
  });

  it("counts only remaining questions for Skip all and does not count its replay", async () => {
    const user = await learner();

    const goal = await goalFixture({
      details: { answered: ["tools"] },
      planRevealedAt: null,
      userId: user.id,
    });

    await prisma.profileAnswer.create({
      data: {
        answeredAt: new Date(),
        outcome: "answered",
        question: "watch",
        userId: user.id,
        version: 1,
      },
    });

    const flush = runDeferredWork();

    const request = {
      goalId: goal.id,
      input: { forever: false, question: "skipProfile" },
    } as const;

    await answerOnboardingQuestion(request);
    await answerOnboardingQuestion(request);
    await flush();

    expect(events("Profile Questions Skipped")).toStrictEqual([
      expect.objectContaining({ properties: { remaining: 8 } }),
    ]);

    expect(events("Profile Question Saved")).toStrictEqual([]);
  });

  it("tracks Don't ask me again once while preserving answered questions", async () => {
    const user = await learner();
    const goal = await goalFixture({ planRevealedAt: null, userId: user.id });

    await prisma.profileAnswer.create({
      data: {
        answeredAt: new Date(),
        outcome: "answered",
        question: "watch",
        userId: user.id,
        version: 1,
      },
    });

    const flush = runDeferredWork();
    const request = { goalId: goal.id, input: { forever: true, question: "skipProfile" } } as const;
    await answerOnboardingQuestion(request);
    await answerOnboardingQuestion(request);
    await flush();

    expect(events("Profile Questions Skipped")).toStrictEqual([
      expect.objectContaining({ properties: { remaining: 9 } }),
    ]);

    expect(events("Profile Question Saved")).toStrictEqual([]);
    await expect(prisma.profileAnswer.count({ where: { userId: user.id } })).resolves.toBe(10);
  });

  it("does not count memory-gated biography questions in Skip all", async () => {
    const user = await learner();

    const [goal] = await Promise.all([
      goalFixture({ planRevealedAt: null, userId: user.id }),
      learningProfileFixture({ memoryEnabled: false, userId: user.id }),
    ]);

    const flush = runDeferredWork();

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { forever: false, question: "skipProfile" },
    });

    await flush();

    expect(events("Profile Questions Skipped")).toStrictEqual([
      expect.objectContaining({ properties: { remaining: 2 } }),
    ]);
  });

  it.each([
    { memoryEnabled: false, remaining: 2, skipWork: false },
    { memoryEnabled: true, remaining: 9, skipWork: true },
  ])(
    "counts only currently offered questions for Don't ask again: $memoryEnabled/$skipWork",
    async ({ memoryEnabled, remaining, skipWork }) => {
      const user = await learner();

      const [goal] = await Promise.all([
        goalFixture({ planRevealedAt: null, userId: user.id }),
        learningProfileFixture({ memoryEnabled, userId: user.id }),
      ]);

      const flush = runDeferredWork();

      if (skipWork) {
        await answerOnboardingQuestion({
          goalId: goal.id,
          input: { answer: null, question: "work" },
        });
      }

      const request = {
        goalId: goal.id,
        input: { forever: true, question: "skipProfile" },
      } as const;

      await answerOnboardingQuestion(request);
      await answerOnboardingQuestion(request);
      await flush();

      expect(events("Profile Questions Skipped")).toStrictEqual([
        expect.objectContaining({ properties: { remaining } }),
      ]);

      await expect(
        prisma.profileAnswer.count({ where: { outcome: "declined", userId: user.id } }),
      ).resolves.toBe(10);
    },
  );

  it("respects the usage-data choice for saves and bulk skips", async () => {
    const user = await learner();

    const [goal] = await Promise.all([
      goalFixture({ planRevealedAt: null, userId: user.id }),
      learningProfileFixture({ shareUsageData: false, userId: user.id }),
    ]);

    const flush = runDeferredWork();

    await answerProfileQuestion({
      input: profileAnswerInputSchema.parse({ answer: { picks: ["anime"] }, question: "watch" }),
      locale: "en",
    });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { forever: false, question: "skipProfile" },
    });

    await flush();
    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it("emits nothing for invalid, unconsented, memory-gated or unowned writes", async () => {
    const user = await learner();
    const other = await userFixture();

    const [goal] = await Promise.all([
      goalFixture({ planRevealedAt: null, userId: other.id }),
      learningProfileFixture({ memoryEnabled: false, userId: user.id }),
    ]);

    const flush = runDeferredWork();

    await expect(save({ answer: {}, question: "watch" })).resolves.toStrictEqual({
      status: "invalid",
    });

    await expect(
      save({ answer: { conditions: [{ condition: "adhd" }] }, question: "conditions" }),
    ).resolves.toStrictEqual({ status: "consentRequired" });

    await expect(save({ answer: { picks: ["anime"] }, question: "watch" })).resolves.toStrictEqual({
      status: "memoryOff",
    });

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { forever: false, question: "skipProfile" },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);

    await expect(save({ answer: { declined: true }, question: "watch" })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    await flush();
    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it.each(["conditions", "learningSupport"] as const)(
    "tracks the %s onboarding question without sensitive ids",
    async (question) => {
      const user = await learner();
      const goal = await goalFixture({ planRevealedAt: null, userId: user.id });
      const flush = runDeferredWork();

      await answerOnboardingQuestion({
        goalId: goal.id,
        input: profileAnswerInputSchema.parse({ answer: { declined: true }, question }),
      });

      await flush();

      expect(events("Profile Question Saved")).toStrictEqual([
        expect.objectContaining({
          properties: {
            from: "onboarding",
            question,
            ...(question === "conditions" ? {} : { outcome: "declined" }),
          },
        }),
      ]);

      expect(events("Onboarding Progressed")).toStrictEqual([
        expect.objectContaining({
          properties: expect.objectContaining({
            goal_id: goal.id,
            question,
            stage: "question_answered",
          }),
        }),
      ]);
    },
  );
});
