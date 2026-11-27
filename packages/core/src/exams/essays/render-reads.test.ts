import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { getEssay } from "./get-essay";

describe("essay render reads", () => {
  it("reads a scheduled essay's prompt and drafts without writing", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const user = await userFixture();

    const blueprint = await examBlueprintFixture({
      name: "ENEM",
      structure: {
        formats: [
          {
            citation: { passage: "", sourceId: "n" },
            description: "Essay",
            kind: "essay",
            options: null,
          },
        ],
        mock: null,
        rules: [],
        subjects: [],
      },
    });

    const { goal, skills } = await sessionGoalFixture({
      goal: { dailyMinutes: 90, examBlueprintId: blueprint.id, kind: "exam" },
      userId: user.id,
    });

    const item = await itemFixture({
      content: {
        context: "Theme: disinformation",
        keyPoints: ["Develop a supported argument"],
        question: "Write an essay",
        rubric: [
          { criterion: "Writing", description: "Clear writing" },
          { criterion: "Argument", description: "Support the argument" },
        ],
        sampleOutline: "Introduction and argument",
        writing: {
          aspects: [],
          assessedSkillIds: [skills[0]!.id],
          charactersPerLine: 55,
          criteria: [{ id: "claim", name: "Claim", points: null }],
          grading: { criteria: [], language: null, rounding: null, zeroing: [] },
          keySource: "practiceKey",
          lines: 30,
          minimumWords: 30,
          points: 1000,
          taskKey: "redacao",
          title: "Disinformation",
          unit: "answer",
        },
      },
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skills[0]!.id,
    });

    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    const admissionId = randomUUID();

    await prisma.writingAdmission.create({
      data: {
        extra: false,
        id: admissionId,
        itemIds: [item.id],
        localDate: session.localDate,
        userId: user.id,
      },
    });

    const block = await studySessionBlockFixture({
      kind: "produce",
      payload: {
        itemIds: [item.id],
        writing: { admissionId, draft: null, taskKey: "redacao", unit: "answer" },
      },
      sessionId: session.id,
    });

    mockSession(user.id);
    const counts = await countDatabaseStatements(() => getEssay({ blockId: block.id }));
    expect(counts.writes).toBe(0);

    expect(counts.result).toMatchObject({ essay: { drafts: [] }, status: "ready" });
  });
});
