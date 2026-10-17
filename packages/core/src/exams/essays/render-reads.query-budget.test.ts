import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { SESSION_NOW, sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { getEssay } from "./get-essay";

describe("essay render read budget", () => {
  it("reads a scheduled essay's prompt and drafts", async () => {
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

    await itemFixture({
      content: {
        context: "Theme: disinformation",
        keyPoints: ["Develop a supported argument"],
        question: "Write an essay",
        rubric: [
          { criterion: "Writing", description: "Clear writing" },
          { criterion: "Argument", description: "Support the argument" },
        ],
        sampleOutline: "Introduction and argument",
      },
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skills[0]!.id,
    });

    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error(today.status);
    }

    const block = today.session.blocks.find((candidate) => candidate.kind === "produce");

    if (!block) {
      throw new Error("Expected scheduled writing");
    }

    const counts = await countDatabaseStatements(() => getEssay({ blockId: block.id }));
    assertReadBudget(counts, 10);
    expect(counts.result.status).toBe("ready");
  });
});
