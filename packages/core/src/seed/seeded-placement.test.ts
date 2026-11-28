import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type SeedPersonaName } from "@zoonk/db/seed/personas";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { t } from "../../../db/src/prisma/seed/_utils/localize";
import { englishLevelTest } from "../../../db/src/prisma/seed/library/english/english-level-test";
import { type SeedCourse } from "../../../db/src/prisma/seed/library/types";
import { writeLibraryCourse } from "../../../db/src/prisma/seed/library/write-course";
import { mockSession } from "../_test-utils/mock-session";
import { levelTestBankSchema } from "../language/level-test/level-test-contract";
import { startLanguageLevelTest } from "../language/level-test/start-language-level-test";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { loadPlacementItems } from "../learner/placement/_utils/placement-bank-items";
import { pickPlacementItemSkills } from "../lookahead/placement-item-skills";
import { seedPersonaCopy } from "./seed";

function listMissing(picks: Awaited<ReturnType<typeof pickPlacementItemSkills>>) {
  return picks.skills.map(
    (skill) =>
      `${skill.name}: ${skill.needsQuick ? "a quick question, " : ""}${skill.tapsNeeded} taps`,
  );
}

async function copyAtPlacement(persona: SeedPersonaName) {
  return seedPersonaCopy({
    copyKey: crypto.randomUUID().slice(0, 8),
    email: `placement-${crypto.randomUUID()}@zoonk.test`,
    persona,
    state: "placement",
  });
}

describe("placement on a seeded plan", () => {
  it.each<SeedPersonaName>(["stocks", "exam"])(
    "asks %s only questions the seed wrote, so no model writes any",
    async (persona) => {
      const { goalId } = await copyAtPlacement(persona);
      const picks = await pickPlacementItemSkills({ forPlacement: true, goalId });

      expect(listMissing(picks)).toStrictEqual([]);
    },
  );

  it("asks a whole-course test about every topic of the plan from the seed's questions", async () => {
    const { goalId } = await copyAtPlacement("stocks");
    const skillIds = await loadGoalSkillIds(goalId);

    const [picks, items] = await Promise.all([
      pickPlacementItemSkills({ forPlacement: true, goalId, skillIds }),
      loadPlacementItems({ examBlueprintId: null, skillIds }),
    ]);

    expect(listMissing(picks)).toStrictEqual([]);

    expect(new Set(items.map((item) => item.format))).toStrictEqual(
      new Set(["matchPairs", "multipleChoice", "order", "trueFalse"]),
    );
  });
});

function languageCourse(): SeedCourse {
  const key = `level-test-${randomUUID()}`;

  return {
    category: "languages",
    chapters: [],
    description: t("A language", "Um idioma"),
    format: "language",
    items: [],
    key,
    languages: ["pt"],
    levelTest: englishLevelTest,
    skills: [],
    slug: t(`${key}-en`, `${key}-pt`),
    targetLanguage: `en-x-${randomUUID().slice(0, 5)}`,
    title: t("A language", "Um idioma"),
  };
}

async function reseed(course: SeedCourse) {
  const organization = await organizationFixture();
  await writeLibraryCourse({ course, organizationId: organization.id, prisma });

  const stored = await prisma.languageLevelTest.findUniqueOrThrow({
    where: { languagePair: { language: "pt", targetLanguage: course.targetLanguage ?? "" } },
  });

  return levelTestBankSchema.parse(stored.content);
}

describe("a reseed of a language course's level test", () => {
  it("opens a learner's level test on a question the seed wrote, with nothing left to write", async () => {
    const course = languageCourse();
    await reseed(course);

    const { goal, user } = await languageGoalFixture();

    await prisma.goal.update({
      data: { targetLanguage: course.targetLanguage },
      where: { id: goal.id },
    });

    mockSession(user.id);
    const started = await startLanguageLevelTest({ goalId: goal.id });

    const owed = await prisma.followUp.count({
      where: { kind: "prepareLevelTestBank", userId: user.id },
    });

    expect(
      started.status === "ready" && started.test.status === "ready" && started.test.next.kind,
    ).toBe("question");

    expect(owed).toBe(0);
  });

  it("adds the seed's questions and level checks to a bank the app wrote, keeping the app's", async () => {
    const course = languageCourse();
    const appQuestion = { ...englishLevelTest.questions[0], id: "app-question" };

    await prisma.languageLevelTest.create({
      data: {
        content: { questions: [appQuestion] },
        language: "pt",
        model: "app-model",
        promptVersion: "app",
        runId: "app-run",
        targetLanguage: course.targetLanguage ?? "",
      },
    });

    const bank = await reseed(course);

    expect(bank.questions.map(({ id }) => id)).toStrictEqual([
      "app-question",
      ...englishLevelTest.questions.map(({ id }) => id),
    ]);

    expect(bank.confirmations).toHaveLength(englishLevelTest.confirmations.length);
  });

  it("keeps a level check the app appended to the seed's bank", async () => {
    const course = languageCourse();
    const seeded = await reseed(course);
    const appended = { ...englishLevelTest.confirmations[0], id: "confirmation-refill-1-0" };

    await prisma.languageLevelTest.update({
      data: { content: { ...seeded, confirmations: [...(seeded.confirmations ?? []), appended] } },
      where: { languagePair: { language: "pt", targetLanguage: course.targetLanguage ?? "" } },
    });

    const bank = await reseed(course);

    expect(bank.confirmations?.map(({ id }) => id)).toContain("confirmation-refill-1-0");
  });
});
