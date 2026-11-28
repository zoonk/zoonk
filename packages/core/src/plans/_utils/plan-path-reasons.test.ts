import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type NotPlannedReason } from "../../view-models/syllabus/syllabus-contract";
import { loadPlanContext } from "./plan-context";
import { buildPlanPath } from "./plan-path-view";

describe("a left-out phase uses the syllabus facts", () => {
  it.each(["time", "skipped", "missing", "pastBasics", "skippedBase", "known"] as const)(
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
          knownSkillIds: new Set(reason === "known" ? ["basis"] : []),
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

function lessonOn({ day, phase, skillId }: { day: string; phase: number; skillId: string }) {
  return {
    chapterId: null,
    completedAt: null,
    id: skillId,
    kind: "lesson" as const,
    lessonId: null,
    phase,
    position: phase,
    scheduledFor: new Date(`${day}T00:00:00Z`),
    skillId,
    status: "todo" as const,
    titleSnapshot: skillId,
  };
}

describe("a phase the plan holds part of", () => {
  it("names the skills its date leaves out, and none for a phase left out whole", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      targetDate: new Date("2026-12-27T00:00:00Z"),
      userId: user.id,
    });

    const phases = [{ name: "Juz' Amma" }, { name: "Long surahs" }, { name: "Al-Baqarah" }];

    await planFixture({
      goalId: goal.id,
      graph: {
        phases,
        skills: [
          { area: "Short surahs", lessons: 1, name: "Memorize An-Naba", phase: 0, skillId: "naba" },
          {
            area: "Long surahs",
            lessons: 1,
            name: "Memorize Surahs 64–66",
            phase: 1,
            skillId: "s64",
          },
          {
            area: "Long surahs",
            lessons: 1,
            name: "Memorize Surahs 56–58",
            phase: 1,
            skillId: "s56",
          },
          { area: "Long surahs", lessons: 1, name: "Memorize Al-Hadid", phase: 1, skillId: "s57" },
          {
            area: "Long surahs",
            lessons: 1,
            name: "Memorize Al-Waqi'ah",
            phase: 1,
            skillId: "known",
          },
          { area: "Al-Baqarah", lessons: 1, name: "Memorize Al-Baqarah", phase: 2, skillId: "s2" },
        ],
      },
      phases,
    });

    const context = await loadPlanContext({ goal, now: new Date("2026-11-27T12:00:00Z") });

    if (!context) {
      throw new Error("Fixture must have a saved plan");
    }

    context.items = [
      lessonOn({ day: "2026-11-27", phase: 0, skillId: "naba" }),
      lessonOn({ day: "2026-12-20", phase: 1, skillId: "s64" }),
    ];

    const path = buildPlanPath({
      access: { mocksRequirePlus: false },
      challengeResults: new Map(),
      chapterTitles: new Map(),
      context,
      currentPhase: 0,
      skillAreas: new Map(),
      syllabus: {
        knownSkillIds: new Set(["known"]),
        pastBasicsSkillIds: new Set(),
        skippedBaseIds: new Set(),
      },
      today: { blocks: [], session: null },
    });

    expect(path.map((phase) => [phase.state, phase.leftOut])).toStrictEqual([
      ["current", []],
      ["upcoming", ["Memorize Surahs 56–58", "Memorize Al-Hadid"]],
      ["leftOut", []],
    ]);
  });
});
