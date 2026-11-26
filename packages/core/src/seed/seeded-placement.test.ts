import { type SeedPersonaName } from "@zoonk/db/seed/personas";
import { describe, expect, it } from "vitest";
import { loadGoalSkillIds } from "../learner/_utils/goal-skill-graph";
import { pickPlacementItemSkills } from "../lookahead/placement-item-skills";
import { seedPersonaCopy } from "./seed";

/** Each skill's questions a model would still have to write, so a failure names what to add. */
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
});
