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
  it("accepts picks shown before either rewrite and keeps them visible", async () => {
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

    await learningProfileFixture({ suggestedTools: ["Tasy", "Whitebook"], userId });

    await expect(save({ answer: { picks: ["excel"] }, question: "tools" })).resolves.toMatchObject({
      question: { saved: { picks: ["excel"] } },
      status: "saved",
    });

    await learningProfileFixture({ suggestedTools: ["Medscape"], userId });

    await expect(
      save({ answer: { picks: [" Tasy ", "excel", "Tasy"] }, question: "tools" }),
    ).resolves.toMatchObject({
      question: {
        options: [
          { id: "Medscape", label: "Medscape" },
          { id: "Tasy", label: "Tasy" },
          { id: "excel", label: "Excel" },
        ],
        saved: { picks: ["Tasy", "excel"] },
      },
      status: "saved",
    });
  });

  it("uses the general id for a suggested name that matches its label", async () => {
    const userId = await learner();
    await save({ answer: { picks: ["excel"] }, question: "tools" });
    await learningProfileFixture({ suggestedTools: ["eXcEl", "Tasy"], userId });

    await expect(toolsView()).resolves.toMatchObject({
      options: [
        { id: "excel", label: "Excel" },
        { id: "Tasy", label: "Tasy" },
      ],
      saved: { picks: ["excel"] },
    });
  });

  it("reopens a typed tool as a selected option after a rewrite", async () => {
    const userId = await learner();
    await save({ answer: { favorites: "sap, LibreLink" }, question: "tools" });
    await learningProfileFixture({ suggestedTools: ["SAP", "Tasy"], userId });

    await expect(toolsView()).resolves.toMatchObject({
      options: [
        { id: "SAP", label: "SAP" },
        { id: "Tasy", label: "Tasy" },
      ],
      saved: { picks: ["SAP"], text: "LibreLink" },
    });

    await expect(
      save({ answer: { favorites: "LibreLink", picks: ["SAP"] }, question: "tools" }),
    ).resolves.toMatchObject({ changed: true, status: "saved" });

    await expect(
      prisma.memoryFact.findMany({ where: { status: "active", userId } }),
    ).resolves.toMatchObject([
      {
        profileAnswer: { favorites: ["LibreLink"], picks: ["SAP"] },
        statement: "Uses SAP and LibreLink",
      },
    ]);
  });

  it("saves each tool once across typed names, current picks and stale picks", async () => {
    const userId = await learner();
    await learningProfileFixture({ suggestedTools: ["Excel", "SAP", "Tasy"], userId });

    const input = {
      answer: {
        favorites: "TASY; librelink; sAp; EXCEL; Other Tool",
        picks: ["sap", "excel", "Excel", "LibreLink", "librelink"],
      },
      question: "tools",
    };

    await expect(save(input)).resolves.toMatchObject({
      question: {
        options: [{ id: "excel" }, { id: "SAP" }, { id: "Tasy" }, { id: "LibreLink" }],
        saved: { picks: ["excel", "SAP", "Tasy", "LibreLink"], text: "Other Tool" },
      },
      status: "saved",
    });

    await expect(
      prisma.memoryFact.findMany({ where: { status: "active", userId } }),
    ).resolves.toMatchObject([
      {
        profileAnswer: { favorites: ["Other Tool"], picks: ["LibreLink", "SAP", "Tasy", "excel"] },
        statement: "Uses LibreLink, SAP, Tasy, Excel, and Other Tool",
      },
    ]);

    await expect(save(input)).resolves.toMatchObject({ changed: false, status: "saved" });
  });

  it("keeps a matching typed name editable when all 100 pick slots are used", async () => {
    const userId = await learner();
    const picks = ["Tasy", ...Array.from({ length: 99 }, (_, index) => `Tool ${index}`)];
    await learningProfileFixture({ suggestedTools: ["Tasy", "SAP"], userId });

    await expect(
      save({ answer: { favorites: "SAP", picks }, question: "tools" }),
    ).resolves.toMatchObject({ status: "saved" });

    const view = await toolsView();
    expect(view?.options.some(({ id }) => id === "SAP")).toBe(false);

    expect(view?.saved).toMatchObject({
      picks: ["Tasy", ...picks.slice(1).toSorted()],
      text: "SAP",
    });

    await expect(
      save({
        answer: { favorites: view?.saved.text, picks: view?.saved.picks },
        question: "tools",
      }),
    ).resolves.toMatchObject({ changed: false, status: "saved" });
  });

  it.each([
    { picks: ["excel"], sensitive: false, statement: "Uses Excel" },
    { picks: ["LibreLink"], sensitive: true, statement: "Uses LibreLink" },
  ])(
    "checks sensitivity according to whether $picks is a general id",
    async ({ picks, sensitive, statement }) => {
      const userId = await learner();
      await learningProfileFixture({ suggestedTools: ["LibreLink"], userId });

      await expect(save({ answer: { picks }, question: "tools" })).resolves.toMatchObject({
        status: "saved",
      });

      const fact = await prisma.memoryFact.findFirstOrThrow({ where: { userId } });
      expect(fact).toMatchObject({ sensitive, statement });

      const followUps = await listFollowUps(userId);

      expect(followUps.filter(({ kind }) => kind === "checkFactSensitivity")).toHaveLength(
        sensitive ? 1 : 0,
      );
    },
  );

  it.each([
    { label: "a blank name", picks: ["  "] },
    { label: "an overlong name", picks: ["x".repeat(121)] },
    { label: "too many names", picks: Array.from({ length: 101 }, (_, index) => `Tool ${index}`) },
  ])("rejects $label at the answer boundary", ({ picks }) => {
    expect(
      profileAnswerInputSchema.safeParse({ answer: { picks }, question: "tools" }).success,
    ).toBe(false);
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
