import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, it } from "vitest";
import { toBlockPayload } from "../block-payload";
import { loadDayMissionFacts } from "./day-facts";
import { pickMissions } from "./pick-missions";

const now = new Date("2026-10-13T12:00:00Z");
const localDate = new Date("2026-10-13T00:00:00Z");

async function load(input: Awaited<ReturnType<typeof languageGoalFixture>>) {
  return loadDayMissionFacts({
    blocks: [
      {
        canDo: null,
        estimatedMinutes: 8,
        kind: "review",
        lessonId: null,
        payload: toBlockPayload({}),
      },
      {
        canDo: null,
        estimatedMinutes: 8,
        kind: "learn",
        lessonId: input.lessons[0]?.id ?? null,
        payload: toBlockPayload({ chapterId: input.arriving.id }),
      },
    ],
    goal: input.goal,
    localDate,
    now,
    plannedMinutes: 16,
    timeZone: "UTC",
    userId: input.user.id,
  });
}

async function duePronunciation(
  input: Awaited<ReturnType<typeof languageGoalFixture>>,
  count: number,
) {
  const organization = await organizationFixture();

  const words = await Promise.all(
    Array.from({ length: count }, () =>
      wordFixture({ organizationId: organization.id, targetLanguage: "en" }),
    ),
  );

  await Promise.all(
    words.map((word) =>
      pronunciationReviewFixture({ dueAt: now, userId: input.user.id, wordId: word.id }),
    ),
  );
}

describe("language mission eligibility against real quota and material rows", () => {
  it("does not offer an AI pronunciation round when its assistance quota is used", async () => {
    const input = await languageGoalFixture();

    await Promise.all([
      duePronunciation(input, 1),
      usageRecordsFixture({ count: 100, createdAt: now, kind: "assist", userId: input.user.id }),
    ]);

    const facts = await load(input);
    expect(facts.candidates.some((pick) => pick.kind === "pronunciation")).toBe(false);
  });

  it("requires enough assistance quota to finish the due round", async () => {
    const input = await languageGoalFixture();

    await Promise.all([
      duePronunciation(input, 2),
      usageRecordsFixture({ count: 99, createdAt: now, kind: "assist", userId: input.user.id }),
    ]);

    const facts = await load(input);
    expect(facts.candidates.some((pick) => pick.kind === "pronunciation")).toBe(false);
  });

  it("offers due pronunciation when the entire round fits its quota", async () => {
    const input = await languageGoalFixture();

    await Promise.all([
      duePronunciation(input, 2),
      usageRecordsFixture({ count: 98, createdAt: now, kind: "assist", userId: input.user.id }),
    ]);

    const facts = await load(input);
    expect(facts.candidates.some((pick) => pick.kind === "pronunciation")).toBe(true);
  });

  it("does not offer a call after this month's free call time is gone", async () => {
    const input = await languageGoalFixture();

    await usageRecordsFixture({
      count: 1,
      createdAt: new Date("2026-10-12T12:00:00Z"),
      kind: "conversation",
      seconds: 300,
      userId: input.user.id,
    });

    const facts = await load(input);
    expect(facts.candidates.some((pick) => pick.kind === "call")).toBe(false);
  });

  it("offers a one-minute call when one minute is left", async () => {
    const input = await languageGoalFixture();

    await usageRecordsFixture({
      count: 1,
      createdAt: now,
      kind: "conversation",
      seconds: 60,
      userId: input.user.id,
    });

    const facts = await load(input);

    expect(facts.candidates.find((pick) => pick.kind === "call")?.opens).toMatchObject({
      chapterId: input.arriving.id,
      kind: "call",
    });
  });

  it("names the unit a call is about, as the unit's page does", async () => {
    const input = await languageGoalFixture();
    const facts = await load(input);

    expect(facts.candidates.find((pick) => pick.kind === "call")?.detail).toStrictEqual({
      chapterTitle: "Chegando",
    });
  });

  it("keeps calls and buddy questions out of a guest's missions and first steps", async () => {
    const input = await languageGoalFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: input.user.id } });
    const facts = await load(input);

    expect(facts.candidates.some((pick) => pick.kind === "call" || pick.kind === "askBuddy")).toBe(
      false,
    );

    expect(
      facts.firstSteps?.steps.some((step) => step.kind === "call" || step.kind === "askBuddy"),
    ).toBe(false);
  });

  it("prioritizes a valid pattern's final offer day without spending AI usage", async () => {
    const input = await languageGoalFixture();

    const pattern = await prisma.mistakePattern.create({
      data: {
        content: {
          contrast: [],
          drill: [
            {
              answer: "for",
              feedback: "Use for with a duration.",
              options: ["for", "since"],
              sentence: "I studied ___ two years.",
            },
          ],
          examples: [],
          rule: "Use for with a duration.",
        },
        createdAt: new Date("2026-10-07T12:00:00Z"),
        goalId: input.goal.id,
        kind: "pattern",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "For and since",
        userId: input.user.id,
      },
    });

    const facts = await load(input);
    facts.firstSteps = null;

    expect(pickMissions(facts).at(-1)).toMatchObject({
      anchor: { patternId: pattern.id },
      kind: "pattern",
    });

    await expect(prisma.usageRecord.count({ where: { userId: input.user.id } })).resolves.toBe(0);
    await expect(prisma.aiCall.count({ where: { userId: input.user.id } })).resolves.toBe(0);
  });
});
