import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { listFollowUps } from "../../follow-ups/follow-up-rows";
import { answerProfileQuestion } from "./answer-profile-question";
import { getProfileQuestions } from "./get-profile-questions";
import { profileAnswerInputSchema } from "./profile-question-contract";
import { skipProfileQuestions } from "./skip-profile-questions";

async function learner() {
  const user = await userFixture();
  mockSession(user.id);
  return user.id;
}

function save(input: unknown) {
  return answerProfileQuestion({ input: profileAnswerInputSchema.parse(input), locale: "en" });
}

async function toolsView() {
  const profile = await getProfileQuestions({ locale: "en" });
  return profile?.questions.find((question) => question.id === "tools");
}

async function toolsFollowUps(userId: string) {
  const followUps = await listFollowUps(userId);
  return followUps.filter(({ kind }) => kind === "suggestProfileTools");
}

describe("profile tools", () => {
  it("offers the general eight and keeps already saved ids across a rewrite", async () => {
    const userId = await learner();
    const fallback = await toolsView();

    expect(fallback?.options.map(({ id }) => id)).toStrictEqual([
      "excel",
      "googleSheets",
      "word",
      "powerPoint",
      "canva",
      "figma",
      "notion",
      "vsCode",
    ]);

    await save({ answer: { picks: ["excel"] }, question: "tools" });
    await learningProfileFixture({ suggestedTools: ["Tasy", "Whitebook"], userId });

    const personalized = await toolsView();

    expect(personalized?.options).toStrictEqual([
      { description: null, id: "Tasy", label: "Tasy" },
      { description: null, id: "Whitebook", label: "Whitebook" },
      { description: null, id: "excel", label: "Excel" },
    ]);

    await expect(
      save({ answer: { picks: ["Tasy", "excel"] }, question: "tools" }),
    ).resolves.toMatchObject({ status: "saved" });

    await expect(
      save({ answer: { picks: ["Tasy", "constructor"] }, question: "tools" }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(save({ answer: { picks: ["figma"] }, question: "tools" })).resolves.toStrictEqual({
      status: "invalid",
    });

    await learningProfileFixture({ suggestedTools: ["Medscape"], userId });

    await expect(toolsView()).resolves.toMatchObject({
      options: [
        { id: "Medscape", label: "Medscape" },
        { id: "Tasy", label: "Tasy" },
        { id: "excel", label: "Excel" },
      ],
      saved: { picks: ["Tasy", "excel"] },
    });
  });

  it("saves every pick and the full sensitive memory statement beyond 300 characters", async () => {
    const userId = await learner();

    const picks = [
      "Adobe After Effects",
      "Adobe Creative Cloud",
      "Adobe Premiere Pro",
      "Autodesk Fusion 360",
      "DaVinci Resolve Studio",
      "Microsoft PowerPoint",
      "Unreal Engine Marketplace",
      "Wacom Desktop Center",
    ];

    const favorites = [
      "Digital Media Asset Production Suite Enterprise",
      "Visual Collaboration and Mapping Workplace Enterprise",
      "Affinity Photo",
    ];

    await learningProfileFixture({ suggestedTools: picks, userId });

    await expect(
      save({ answer: { favorites: favorites.join(";"), picks }, question: "tools" }),
    ).resolves.toMatchObject({
      question: { saved: { picks, text: favorites.join(", ") } },
      status: "saved",
    });

    const statement = `Uses ${new Intl.ListFormat("en").format([...picks, ...favorites])}`;
    expect(statement.length).toBeGreaterThan(300);

    await expect(prisma.memoryFact.findFirst({ where: { userId } })).resolves.toMatchObject({
      sensitive: true,
      statement,
    });
  });

  it("owes one revision for each changed work or studies write and none for a replay", async () => {
    const userId = await learner();
    const work = { answer: { status: "student" }, question: "work" };

    await Promise.all([save(work), save(work)]);
    const [first] = await toolsFollowUps(userId);
    expect(first).toMatchObject({ input: { language: "en" }, revision: 0 });

    await save({ answer: { declined: true }, question: "studies" });
    await expect(toolsFollowUps(userId)).resolves.toMatchObject([{ id: first?.id, revision: 1 }]);

    await save({ answer: { studies: [{ field: "health" }] }, question: "studies" });
    await expect(toolsFollowUps(userId)).resolves.toMatchObject([{ id: first?.id, revision: 2 }]);
  });

  it.each([false, true])(
    "owes one ask for a skip and none for a replay with forever=%s",
    async (forever) => {
      const userId = await learner();
      const goal = await goalFixture({ planRevealedAt: null, userId });

      const request = {
        forever,
        goalId: goal.id,
        locale: "pt",
        questions: ["work", "studies"],
      } as const;

      await skipProfileQuestions({ ...request, questions: [...request.questions] });
      await skipProfileQuestions({ ...request, questions: [...request.questions] });

      await expect(toolsFollowUps(userId)).resolves.toMatchObject([
        { input: { language: "pt" }, revision: 0 },
      ]);
    },
  );

  it("owes nothing for a work save or either kind of skip with memory off", async () => {
    const userId = await learner();

    const [goal] = await Promise.all([
      goalFixture({ planRevealedAt: null, userId }),
      learningProfileFixture({ memoryEnabled: false, userId }),
    ]);

    await expect(save({ answer: { status: "student" }, question: "work" })).resolves.toStrictEqual({
      status: "memoryOff",
    });

    await skipProfileQuestions({ goalId: goal.id, questions: ["work"] });
    await skipProfileQuestions({ forever: true, goalId: goal.id, questions: ["studies"] });
    await expect(toolsFollowUps(userId)).resolves.toStrictEqual([]);
  });
});
