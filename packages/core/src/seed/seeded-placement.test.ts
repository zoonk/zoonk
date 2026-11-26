import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type SeedPersonaName } from "@zoonk/db/seed/personas";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { t } from "../../../db/src/prisma/seed/_utils/localize";
import { englishLevelTest } from "../../../db/src/prisma/seed/library/english/english-level-test";
import { type SeedCourse } from "../../../db/src/prisma/seed/library/types";
import { writeLibraryCourse } from "../../../db/src/prisma/seed/library/write-course";
import { mockSession } from "../_test-utils/mock-session";
import { startLanguageLevelTest } from "../language/level-test/start-language-level-test";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
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

    const picks = await pickPlacementItemSkills({ forPlacement: true, goalId, skillIds });

    expect(listMissing(picks)).toStrictEqual([]);
  });

  it("opens a language learner's level test on a question the seed wrote", async () => {
    const { goalId, userId } = await copyAtPlacement("language");
    mockSession(userId);

    const started = await startLanguageLevelTest({ goalId, length: "quick" });

    const owed = await prisma.followUp.count({ where: { kind: "prepareLevelTestBank", userId } });

    expect(
      started.status === "ready" && started.test.status === "ready" && started.test.next.kind,
    ).toBe("question");

    expect(owed).toBe(0);
  });
});

describe("a reseed of a language course's level test", () => {
  it("keeps the questions the app wrote and adds only the level checks it lacks", async () => {
    const key = `level-test-${randomUUID()}`;
    const targetLanguage = `x-${randomUUID().slice(0, 6)}`;
    const appQuestions = englishLevelTest.questions.slice(0, 2);

    const course: SeedCourse = {
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
      targetLanguage,
      title: t("A language", "Um idioma"),
    };

    await prisma.languageLevelTest.create({
      data: {
        content: { questions: appQuestions },
        language: "pt",
        model: "app-model",
        promptVersion: "app",
        runId: "app-run",
        targetLanguage,
      },
    });

    const organization = await organizationFixture();
    await writeLibraryCourse({ course, organizationId: organization.id, prisma });

    const stored = await prisma.languageLevelTest.findUniqueOrThrow({
      select: { content: true, runId: true },
      where: { languagePair: { language: "pt", targetLanguage } },
    });

    expect(stored).toStrictEqual({
      content: { confirmations: englishLevelTest.confirmations, questions: appQuestions },
      runId: "app-run",
    });
  });
});
