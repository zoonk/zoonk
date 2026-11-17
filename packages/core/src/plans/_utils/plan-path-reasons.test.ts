import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type NotPlannedReason } from "../../view-models/syllabus/syllabus-contract";
import { loadPlanContext } from "./plan-context";
import { buildPlanPath } from "./plan-path-view";

describe("a left-out phase uses the syllabus facts", () => {
  it.each(["time", "skipped", "missing", "pastBasics", "skippedBase", null] as const)(
    "derives %s without inventing a time shortage",
    async (reason) => {
      const user = await userFixture();
      const goal = await goalFixture({ userId: user.id });

      await planFixture({
        goalId: goal.id,
        graph: {
          phases: [{ name: "Current" }, { name: "Basics" }],
          skills:
            reason === "missing"
              ? []
              : [{ area: "Science", lessons: 1, name: "Basics", phase: 1, skillId: "basis" }],
        },
        phases: [{ name: "Current" }, { name: "Basics" }],
        settings: { skippedAreas: reason === "skipped" ? ["Science"] : [] },
      });

      const context = await loadPlanContext({ goal, now: new Date("2026-11-16T12:00:00Z") });

      if (!context) {
        throw new Error("Fixture must have a saved plan");
      }

      context.items = [
        {
          chapterId: null,
          completedAt: null,
          id: "planned",
          kind: "lesson",
          lessonId: null,
          phase: 0,
          position: 0,
          scheduledFor: new Date("2026-11-16T00:00:00Z"),
          skillId: "current",
          status: "todo",
          titleSnapshot: "Current",
        },
      ];

      const input = {
        access: { mocksRequirePlus: false },
        challengeResults: new Map(),
        chapterTitles: new Map(),
        context,
        currentPhase: 0,
        skillAreas: new Map(),
        syllabus: {
          knownSkillIds: new Set(reason === null ? ["basis"] : []),
          pastBasicsSkillIds: new Set(reason === "pastBasics" ? ["basis"] : []),
          skippedBaseIds: new Set(reason === "skippedBase" ? ["basis"] : []),
        },
        today: { blocks: [], session: null },
      };

      const phase = buildPlanPath(input)[1];
      expect(phase?.state).toBe("leftOut");
      expect(phase?.notPlannedReason).toBe(reason satisfies NotPlannedReason | null);
    },
  );
});
