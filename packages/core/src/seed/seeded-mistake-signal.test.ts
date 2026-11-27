import { prisma } from "@zoonk/db";
import { type SeedPersonaName } from "@zoonk/db/seed/personas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listSeedPersonas } from "../../../db/src/prisma/seed/learners/seed-personas";
import { getSeedAnswerEvidence } from "../../../db/src/prisma/seed/learners/write-learning";
import { readSkillMistakeSignals } from "../learner/read-skill-mistake-signals";
import { getStudyAnswerEvidence } from "../sessions/_utils/record-study-answer";
import { getBlockItemIds, readBlockPayload } from "../sessions/block-payload";
import { seedPersonaCopy } from "./seed";

const FRIDAY = new Date("2026-10-16T20:52:12Z");

async function readSeededDay(persona: SeedPersonaName, language?: "en") {
  const copy = await seedPersonaCopy({
    copyKey: `signal-${persona}`,
    email: `seed-signal-${persona}@zoonk.test`,
    language,
    persona,
  });

  const [today, answered] = await Promise.all([
    prisma.studySession.findFirstOrThrow({
      include: {
        blocks: {
          include: { lesson: { select: { skills: { select: { skillId: true } } } } },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { localDate: "desc" },
      where: { userId: copy.userId },
    }),
    prisma.attempt.findMany({
      distinct: ["skillId"],
      select: { skillId: true },
      where: { userId: copy.userId },
    }),
  ]);

  const signals = await readSkillMistakeSignals({
    now: new Date(),
    skillIds: answered.flatMap(({ skillId }) => skillId ?? []),
    userId: copy.userId,
  });

  const stuck = [...signals].flatMap(([skillId, signal]) => (signal.stuck ? [skillId] : []));

  const rows = today.blocks.map((block) => {
    const payload = readBlockPayload(block);

    return {
      mistakes: payload.mistakeIds.length,
      pattern: payload.patternId !== null,
      returning: payload.returning,
      skillIds: block.lesson?.skills.map(({ skillId }) => skillId) ?? [],
      status: block.status,
      timing: payload.timing,
    };
  });

  return { rows, stuck, today };
}

describe("seeded answers", () => {
  it("carry the evidence core's study answers give a placement or a review question", () => {
    const drift = listSeedPersonas({ now: FRIDAY }).flatMap(({ attempts, key }) =>
      attempts.flatMap((attempt) => {
        const seeded = getSeedAnswerEvidence(attempts, attempt);
        const review = attempt.item && seeded !== "replay";

        return review &&
          seeded !== getStudyAnswerEvidence({ blank: false, placement: Boolean(attempt.placement) })
          ? [`${key}: ${attempt.key}`]
          : [];
      }),
    );

    expect(drift).toStrictEqual([]);
  });
});

describe("a persona's seeded day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRIDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records the completed placement questions in today's study history", async () => {
    const { today } = await readSeededDay("exam", "en");

    const review = today.blocks.find(
      (block) => block.kind === "review" && block.status === "completed",
    );

    if (!review) {
      throw new Error("The seeded learner did not finish a review.");
    }

    const payload = readBlockPayload(review);
    expect(payload.placementItemIds).toHaveLength(1);

    const [answers, events, progress] = await Promise.all([
      prisma.attempt.findMany({
        select: { isCorrect: true, isPlacement: true, itemId: true },
        where: { studySessionId: today.id },
      }),
      prisma.learningEvent.findMany({
        select: { correctAnswers: true, lessonKind: true, seconds: true },
        where: { kind: "review", localDate: today.localDate, userId: today.userId },
      }),
      prisma.dailyProgress.findUnique({
        where: { userDate: { date: today.localDate, userId: today.userId } },
      }),
    ]);

    expect(answers).toHaveLength(getBlockItemIds(payload).length);

    expect(answers.map(({ itemId }) => itemId)).toStrictEqual(
      expect.arrayContaining(getBlockItemIds(payload)),
    );

    expect(answers.filter(({ isPlacement }) => isPlacement)).toStrictEqual([
      { isCorrect: true, isPlacement: true, itemId: payload.placementItemIds[0] },
    ]);

    expect(events).toContainEqual({
      correctAnswers: 1,
      lessonKind: "placement",
      seconds: expect.any(Number),
    });

    expect(progress?.timeSpentSeconds).toBeGreaterThan(0);
  });

  it.each([
    { persona: "exam", status: "active", timing: { activeAt: null, elapsedMs: 0 } },
    { persona: "stocks", status: "pending", timing: null },
  ] as const)(
    "$persona: stops at its mistakes before the returning lesson",
    async ({ persona, status, timing }) => {
      const { rows, stuck } = await readSeededDay(persona);
      const returning = rows.filter((row) => row.returning);

      expect(stuck).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status, timing });
      expect(rows[0]?.mistakes).toBeGreaterThan(0);

      expect(returning).toStrictEqual([
        expect.objectContaining({ returning: "again", status: "pending" }),
      ]);

      expect(returning[0]?.skillIds).toContain(stuck[0]);
    },
  );

  it("language: its pattern takes the day's teaching slot, as no skill is stuck", async () => {
    const { rows, stuck } = await readSeededDay("language");

    expect(stuck).toStrictEqual([]);
    expect(rows.filter((row) => row.pattern)).toHaveLength(1);
    expect(rows.filter((row) => row.returning)).toStrictEqual([]);
  });
});
