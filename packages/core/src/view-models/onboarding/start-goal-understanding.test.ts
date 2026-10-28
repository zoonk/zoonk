import { randomUUID } from "node:crypto";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { understandGoal as runUnderstandGoal } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { prisma } from "@zoonk/db";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { buildExamIdentityKey } from "../../library/exams/exam-identity";
import { startGoalUnderstanding } from "./start-goal-understanding";

function uniqueGoal(text: string) {
  return `${text} ${randomUUID()}`;
}

function countAssists(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "assist", userId } });
}

describe(startGoalUnderstanding, () => {
  it("needs a session, which guests have", async () => {
    mockSession(null);

    await expect(
      startGoalUnderstanding({ goal: "quantum physics", language: "en" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("understands words read today at once and keeps the card on the learner's draft", async () => {
    const user = await userFixture();
    mockGuestSession(user.id);
    const goal = uniqueGoal("i want to understand quantum physics for work, 20 min a day");

    await goalUnderstandingFixture({
      goal,
      result: {
        dailyMinutes: 20,
        followUps: ["Which part of your job uses it?"],
        goals: [
          {
            kind: "learn",
            level: "I studied it in college",
            ownLevel: "intermediate",
            purpose: "work",
            subject: "Quantum physics",
            title: "Understand quantum physics",
          },
        ],
        route: "goals",
        studyTimeNote: "After work",
      },
      userId: user.id,
    });

    const result = await startGoalUnderstanding({
      goal,
      language: "en",
      timeZone: "America/Sao_Paulo",
    });

    expect(runUnderstandGoal).not.toHaveBeenCalled();
    await expect(countAssists(user.id)).resolves.toBe(0);
    expect(result.status).toBe("understood");

    const draft = result.status === "understood" ? result.draft : null;

    expect(draft).toMatchObject({
      generationId: null,
      goalId: null,
      prompt: goal,
      status: "understood",
    });

    const understanding = draft?.understanding;

    if (understanding?.status !== "goals") {
      throw new Error("Expected goals");
    }

    expect(understanding.schedule).toStrictEqual({
      dailyMinutes: 20,
      studyDays: null,
      studyTime: null,
      studyTimeNote: "After work",
    });

    expect(understanding.goals[0]?.draft.details).toStrictEqual({
      answered: ["schedule"],
      followUps: [{ answer: null, question: "Which part of your job uses it?" }],
      level: "intermediate",
      levelNote: "I studied it in college",
      onboardingId: draft?.id,
      purpose: "work",
      studyTimeNote: "After work",
      subject: "Quantum physics",
    });

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft?.id } }),
    ).resolves.toMatchObject({
      language: "en",
      status: "understood",
      timeZone: "America/Sao_Paulo",
      understanding,
      userId: user.id,
    });
  });

  it("leaves a date past what a plan reaches off the card, so onboarding asks for one", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const year = new Date().getUTCFullYear();
    const dates = [`${year + 2}-03-31`, `${year + 11}-03-31`];

    const words = dates.map((targetDate) => uniqueGoal(`learn quantum physics by ${targetDate}`));

    await Promise.all(
      dates.map((targetDate, index) =>
        goalUnderstandingFixture({
          goal: words[index] ?? "",
          result: {
            followUps: [],
            goals: [
              {
                kind: "learn",
                ownLevel: "none",
                purpose: "overview",
                subject: "Quantum physics",
                targetDate,
                title: "Understand quantum physics",
              },
            ],
            route: "goals",
          },
          userId: user.id,
        }),
      ),
    );

    const results = await Promise.all(
      words.map((goal) => startGoalUnderstanding({ goal, language: "en", timeZone: "UTC" })),
    );

    const cards = results.map((result) => {
      const understanding = result.status === "understood" ? result.draft.understanding : null;
      return understanding?.status === "goals" ? understanding.goals[0]?.draft : null;
    });

    expect(cards.map((draft) => draft?.targetDate)).toStrictEqual([dates[0], undefined]);
  });

  it("gives an exam the dates of the year named, with the notice they came from", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const examName = `Test Exam ${randomUUID()}`;
    const source = await sourceFixture({ title: "Official notice" });
    const citation = { passage: "The exam takes place on", sourceId: source.id };

    const blueprint = await examBlueprintFixture({
      edition: {
        check: null,
        citations: [],
        dates: [
          { citation, date: "2099-11-15", kind: "exam", label: "Day 2", startTime: null },
          { citation, date: "2099-11-08", kind: "exam", label: "Day 1", startTime: null },
          {
            citation,
            date: "2099-06-01",
            kind: "registrationEnd",
            label: "Registration ends",
            startTime: null,
          },
        ],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: 2099,
      },
      identityKey: buildExamIdentityKey({ name: examName, ownerId: null, role: null }),
      name: examName,
    });

    const goal = uniqueGoal("pass the exam in 2099");

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [{ examName, examYear: 2099, kind: "exam", subject: examName, title: "Pass it" }],
        route: "goals",
      },
      userId: user.id,
    });

    const result = await startGoalUnderstanding({ goal, language: "en" });
    const understanding = result.status === "understood" ? result.draft.understanding : null;
    const [understood] = understanding?.status === "goals" ? understanding.goals : [];
    const official = { title: "Official notice", url: source.url };

    expect(understood?.draft.examBlueprintId).toBe(blueprint.id);

    expect(understood?.examDates).toStrictEqual([
      {
        date: "2099-11-08",
        estimated: false,
        label: "Day 1",
        registrationClosed: false,
        source: official,
      },
      {
        date: "2099-11-15",
        estimated: false,
        label: "Day 2",
        registrationClosed: false,
        source: official,
      },
    ]);
  });

  it("remembers the notice's day the card offers next to a month the learner named", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const examName = `Test Exam ${randomUUID()}`;
    const source = await sourceFixture({ title: "Official notice" });
    const citation = { passage: "The exam takes place on", sourceId: source.id };

    await examBlueprintFixture({
      edition: {
        check: null,
        citations: [],
        dates: [{ citation, date: "2099-11-08", kind: "exam", label: "Exam", startTime: null }],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: 2099,
      },
      identityKey: buildExamIdentityKey({ name: examName, ownerId: null, role: null }),
      name: examName,
    });

    const understand = async (examMonth: number) => {
      const goal = uniqueGoal(`pass the exam in month ${examMonth} of 2099`);

      await goalUnderstandingFixture({
        goal,
        result: {
          followUps: [],
          goals: [
            { examMonth, examName, examYear: 2099, kind: "exam", subject: examName, title: "Pass" },
          ],
          route: "goals",
        },
        userId: user.id,
      });

      const result = await startGoalUnderstanding({ goal, language: "en" });
      const understanding = result.status === "understood" ? result.draft.understanding : null;
      const [understood] = understanding?.status === "goals" ? understanding.goals : [];

      return understood?.draft.details?.offeredNoticeDay;
    };

    await expect(understand(12)).resolves.toBe("2099-11-08");
    await expect(understand(11)).resolves.toBeUndefined();
  });

  it("saves new words as a draft to read in a run, without calling the models here", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const goal = uniqueGoal("learn organic chemistry");

    const result = await startGoalUnderstanding({
      goal,
      language: "pt",
      timeZone: "Europe/Berlin",
    });

    expect(runUnderstandGoal).not.toHaveBeenCalled();
    expect(classifyCourseIntent).not.toHaveBeenCalled();
    await expect(countAssists(user.id)).resolves.toBe(1);

    expect(result).toStrictEqual({
      draft: {
        generationId: null,
        goalId: null,
        id: expect.any(String),
        prompt: goal,
        status: "understanding",
        understanding: null,
      },
      status: "understanding",
    });

    const draftId = result.status === "understanding" ? result.draft.id : "";

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draftId } }),
    ).resolves.toMatchObject({ language: "pt", runId: null, timeZone: "Europe/Berlin" });
  });

  it("asks a guest whose one goal is taken to create an account before anything is read", async () => {
    const guest = await userFixture();
    mockGuestSession(guest.id);
    await usageRecordsFixture({ count: 1, createdAt: new Date(), kind: "goal", userId: guest.id });
    const known = uniqueGoal("learn to bake bread");

    await goalUnderstandingFixture({
      goal: known,
      result: {
        followUps: [],
        goals: [{ kind: "learn", subject: "Baking", title: "Bake bread" }],
        route: "goals",
      },
      userId: guest.id,
    });

    const refused = {
      limit: { limit: 1, period: "total", resource: "goal", tier: "guest" },
      status: "limitReached",
    };

    await expect(startGoalUnderstanding({ goal: known, language: "en" })).resolves.toStrictEqual(
      refused,
    );

    await expect(
      startGoalUnderstanding({ goal: uniqueGoal("learn welding"), language: "en" }),
    ).resolves.toStrictEqual(refused);

    await expect(countAssists(guest.id)).resolves.toBe(0);
    await expect(prisma.onboardingDraft.count({ where: { userId: guest.id } })).resolves.toBe(0);
  });

  it("still reads an account's new goal while another one is active", async () => {
    const user = await userFixture();
    mockSession(user.id);
    await usageRecordsFixture({ count: 1, createdAt: new Date(), kind: "goal", userId: user.id });

    const result = await startGoalUnderstanding({
      goal: uniqueGoal("learn welding"),
      language: "en",
    });

    expect(result.status).toBe("understanding");
  });

  it("asks a guest who used today's small AI calls to sign up, and still reads words known today", async () => {
    const guest = await useGuestOutOfHelp();
    const known = uniqueGoal("learn to cook rice");

    await goalUnderstandingFixture({
      goal: known,
      result: {
        followUps: [],
        goals: [{ kind: "learn", subject: "Cooking", title: "Cook rice" }],
        route: "goals",
      },
      userId: guest.id,
    });

    await expect(
      startGoalUnderstanding({ goal: uniqueGoal("learn welding"), language: "en" }),
    ).resolves.toStrictEqual(GUEST_OUT_OF_HELP);

    await expect(prisma.onboardingDraft.count({ where: { userId: guest.id } })).resolves.toBe(0);

    await expect(startGoalUnderstanding({ goal: known, language: "en" })).resolves.toMatchObject({
      status: "understood",
    });
  });
});
