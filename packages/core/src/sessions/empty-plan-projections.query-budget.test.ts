import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { loadItemSkillRows } from "../learner/_utils/plan-library-rows";
import { loadSkillSurvivorMap } from "../learner/_utils/update-learner-skill";
import { loadSkillPrerequisites } from "../library/skills/skill-prerequisites";

describe("empty day-plan projections", () => {
  it("returns their exact empty values without a database round trip", async () => {
    const counts = await countDatabaseStatements(() =>
      Promise.all([
        loadItemSkillRows({ chapterIds: [], lessonIds: [] }),
        loadSkillSurvivorMap([]),
        loadSkillPrerequisites([]),
      ]),
    );

    expect(counts.result).toStrictEqual([
      { chapterLessons: [], lessonSkills: [] },
      new Map(),
      new Map(),
    ]);

    assertReadBudget(counts, 0);
  });
});
