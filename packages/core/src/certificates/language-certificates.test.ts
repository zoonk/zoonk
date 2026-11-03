import { type LanguageSkill, prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateGoal } from "../goals/update-goal";
import { finishLanguageLevelTest } from "../language/level-test/finish-language-level-test";
import { type LevelTestBank } from "../language/level-test/level-test-contract";
import {
  type SkillEvidence,
  addSkillEvidence,
  loadLanguageSkillEvidence,
} from "../language/levels/record-language-evidence";

const WINDOW = 20;

async function recordSkillEvidence(input: Omit<SkillEvidence, "startScore">) {
  const evidence = await loadLanguageSkillEvidence(input);
  await prisma.$transaction((tx) => addSkillEvidence(tx, evidence));
}

async function languageLearner(level: string) {
  const user = await userFixture();

  const goal = await goalFixture({
    details: { level },
    kind: "language",
    language: "pt",
    targetLanguage: "es",
    userId: user.id,
  });

  return { goal, user };
}

/** A full window of right answers on advanced content: half a step up. */
function raise(userId: string, skill: LanguageSkill) {
  return recordSkillEvidence({
    evidence: { ceiling: 5, correct: WINDOW, total: WINDOW },
    language: "es",
    skill,
    userId,
  });
}

/** A full window of wrong answers: half a step down. */
function lower(userId: string, skill: LanguageSkill) {
  return recordSkillEvidence({
    evidence: { ceiling: 0, correct: 0, total: WINDOW },
    language: "es",
    skill,
    userId,
  });
}

async function repeat(times: number, step: () => Promise<void>) {
  for (let index = 0; index < times; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each window builds on the score the last one left.
    await step();
  }
}

async function levelCertificates(userId: string) {
  const rows = await prisma.certificate.findMany({
    orderBy: { createdAt: "asc" },
    where: { kind: "languageLevel", userId },
  });

  return rows.map((row) => row.level);
}

describe("language level certificates", () => {
  it("awards a band once, when every raised skill has reached the next", async () => {
    const { goal, user } = await languageLearner("A1");

    await repeat(2, () => raise(user.id, "reading"));
    await expect(levelCertificates(user.id)).resolves.toStrictEqual(["A1"]);

    await repeat(2, () => raise(user.id, "listening"));
    await lower(user.id, "reading");
    await raise(user.id, "reading");

    await expect(levelCertificates(user.id)).resolves.toStrictEqual(["A1"]);

    await expect(
      prisma.certificate.findFirst({ where: { kind: "languageLevel", userId: user.id } }),
    ).resolves.toMatchObject({
      goalId: goal.id,
      key: "es:A1",
      language: "pt",
      targetLanguage: "es",
    });
  });

  it("counts nothing a typed level put there until answers raise it", async () => {
    const { user } = await languageLearner("C2");

    await recordSkillEvidence({
      evidence: { ceiling: 5, correct: 0, total: 5 },
      language: "es",
      skill: "writing",
      userId: user.id,
    });

    await raise(user.id, "writing");

    await expect(levelCertificates(user.id)).resolves.toStrictEqual([]);
  });

  it("keeps a raised skill that fell back to its start, so another can't skip a band", async () => {
    const { user } = await languageLearner("A2");

    await raise(user.id, "listening");
    await lower(user.id, "listening");
    await repeat(4, () => raise(user.id, "reading"));

    await expect(levelCertificates(user.id)).resolves.toStrictEqual([]);

    await repeat(2, () => raise(user.id, "listening"));

    await expect(levelCertificates(user.id)).resolves.toStrictEqual(["A2"]);
  });

  it("awards nothing below a placed level until answers take the learner below it and back", async () => {
    const { user } = await languageLearner("B1");

    await raise(user.id, "reading");
    await repeat(4, () => lower(user.id, "reading"));

    await expect(levelCertificates(user.id)).resolves.toStrictEqual([]);

    await raise(user.id, "reading");

    await expect(levelCertificates(user.id)).resolves.toStrictEqual(["A1"]);
  });
});

const TEST_LEVELS = CEFR_LEVELS.slice(0, 5);

const BANK: LevelTestBank = {
  questions: TEST_LEVELS.flatMap((level) =>
    (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndex: 1,
        id: `${skill}-${level}-${index}`,
        level,
        options: ["a", "b", "c", "d"],
        passage: `${skill} passage ${level}`,
        question: "O que diz a mensagem?",
        skill,
      })),
    ),
  ),
  speaking: TEST_LEVELS.map((level) => ({ level, sentence: `Say ${level}`, translation: "Diga" })),
};

type StoredAnswer = { answerIndex: number | null; id: string; skipped?: boolean };

function answers({
  answerIndex = 1,
  levels = ["A2", "B1", "B2"],
  skill,
  skipped,
}: {
  answerIndex?: number | null;
  levels?: string[];
  skill: "listening" | "reading";
  skipped?: boolean;
}): StoredAnswer[] {
  return levels.map((level, index) => ({
    answerIndex,
    id: `${skill}-${level}-${index % 2}`,
    ...(skipped && { skipped }),
  }));
}

async function testTaker(levelAnswers: StoredAnswer[]) {
  await prisma.languageLevelTest.upsert({
    create: {
      content: BANK,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage: "en",
    },
    update: { content: BANK },
    where: { languagePair: { language: "pt", targetLanguage: "en" } },
  });

  const { goal, user } = await languageGoalFixture();

  await prisma.goal.update({
    data: {
      details: {
        ...(goal.details as object),
        levelTest: { answers: levelAnswers, speaking: null },
      },
    },
    where: { id: goal.id },
  });

  mockSession(user.id);
  return { goal, user };
}

describe("placement certificates", () => {
  it("certifies a finished test's measured level once, and a retry changes nothing", async () => {
    const { goal } = await testTaker([
      ...answers({ levels: ["A2", "B1", "B1"], skill: "reading" }),
      ...answers({ levels: ["A2", "B1", "B1"], skill: "listening" }),
    ]);

    const finished = await finishLanguageLevelTest(goal.id);
    const retried = await finishLanguageLevelTest(goal.id);

    expect(finished).toMatchObject({
      certificate: {
        answered: 6,
        kind: "placement",
        level: "B1",
        measuredLevel: "B1+",
        skillLevels: [
          { label: "B1+", skill: "reading" },
          { label: "B1+", skill: "listening" },
        ],
        targetLanguage: "en",
      },
      levels: [
        { label: "B1+", skill: "reading" },
        { label: "B1+", skill: "listening" },
      ],
      status: "ready",
    });

    const code = finished.status === "ready" ? finished.certificate?.code : null;
    expect(retried).toMatchObject({ certificate: { code } });

    await expect(
      prisma.certificate.count({ where: { goalId: goal.id, kind: "placement" } }),
    ).resolves.toBe(1);
  });

  it("leaves skipped skills out of the level", async () => {
    const { goal } = await testTaker([
      ...answers({ skill: "reading" }),
      ...answers({ skill: "listening", skipped: true }),
    ]);

    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({
      certificate: { answered: 3, skillLevels: [{ skill: "reading" }] },
    });
  });

  it.each([
    [
      "a test finished early",
      [...answers({ skill: "reading" }), ...answers({ levels: ["A2"], skill: "listening" })],
    ],
    [
      "a test that measured nothing",
      [
        ...answers({ skill: "reading", skipped: true }),
        ...answers({ skill: "listening", skipped: true }),
      ],
    ],
    [
      "a test whose answers showed nothing above the start of A1",
      [
        ...answers({ answerIndex: null, levels: ["A1", "A1", "A2"], skill: "reading" }),
        ...answers({ answerIndex: null, levels: ["A1", "A1", "A2"], skill: "listening" }),
      ],
    ],
  ])("certifies nothing for %s", async (_case, levelAnswers) => {
    const { goal } = await testTaker(levelAnswers);

    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({
      certificate: null,
      status: "ready",
    });
  });

  it("certifies nothing a typed level suggests when no answer was right", async () => {
    const { goal } = await testTaker([
      ...answers({ answerIndex: null, levels: ["C1", "B2", "B1"], skill: "reading" }),
      ...answers({ answerIndex: null, levels: ["C1", "B2", "B1"], skill: "listening" }),
    ]);

    await updateGoal({ goalId: goal.id, input: { details: { level: "C2" } } });

    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({
      certificate: null,
      status: "ready",
    });
  });

  it("certifies the same answers the same, whatever level the learner typed", async () => {
    const levelAnswers = (["reading", "listening"] as const).flatMap((skill) => [
      ...answers({ levels: ["C1", "C1"], skill }),
      ...answers({ answerIndex: null, levels: ["B2"], skill }),
    ]);

    const typedC1 = await testTaker(levelAnswers);
    await updateGoal({ goalId: typedC1.goal.id, input: { details: { level: "C1" } } });
    const fromC1 = await finishLanguageLevelTest(typedC1.goal.id);

    const typedC2 = await testTaker(levelAnswers);
    await updateGoal({ goalId: typedC2.goal.id, input: { details: { level: "C2" } } });
    const fromC2 = await finishLanguageLevelTest(typedC2.goal.id);

    const certified = (result: typeof fromC1) =>
      result.status === "ready" ? result.certificate?.measuredLevel : null;

    expect(fromC1).toMatchObject({ certificate: { kind: "placement" } });
    expect(certified(fromC2)).toBe(certified(fromC1));
  });

  it("keeps the stored test when a learner sends their own, and certifies only what it measured", async () => {
    const { goal } = await testTaker([]);
    const forged = [...answers({ skill: "reading" }), ...answers({ skill: "listening" })];

    await updateGoal({
      goalId: goal.id,
      input: {
        details: {
          levelTest: { answers: forged, speaking: null },
          skillLevels: { listening: "C1", reading: "C1" },
        },
      },
    });

    const stored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(stored.details).toMatchObject({ levelTest: { answers: [] } });
    expect(stored.details).not.toHaveProperty("skillLevels");

    await expect(finishLanguageLevelTest(goal.id)).resolves.toMatchObject({ certificate: null });
  });

  it("leaves skills lessons raised as they were when another goal's test finishes", async () => {
    const { goal, user } = await testTaker([]);

    await prisma.languageSkillLevel.create({
      data: {
        language: "en",
        raisedAt: new Date(),
        score: 0.5,
        skill: "reading",
        startScore: 0,
        userId: user.id,
      },
    });

    await prisma.goal.update({
      data: { details: { ...(goal.details as object), level: "B1" } },
      where: { id: goal.id },
    });

    await finishLanguageLevelTest(goal.id);

    await expect(
      prisma.languageSkillLevel.findMany({ orderBy: { skill: "asc" }, where: { userId: user.id } }),
    ).resolves.toMatchObject([
      { score: 0.5, skill: "reading", startScore: 0 },
      { score: 2, skill: "listening", startScore: 2 },
    ]);
  });
});
