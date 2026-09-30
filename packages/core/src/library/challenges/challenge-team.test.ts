import { challengeCaseFixture } from "@zoonk/testing/fixtures/challenge-contents";
import { describe, expect, it } from "vitest";
import { buildChallengeTeam, fillChallengeNames, getChallengeNames } from "./challenge-team";

describe(buildChallengeTeam, () => {
  it("picks the same four different names for the same seed", () => {
    const team = buildChallengeTeam({ language: "pt", seed: "plan-1" });
    const again = buildChallengeTeam({ language: "pt", seed: "plan-1" });

    expect(again).toStrictEqual(team);
    expect(team.language).toBe("pt");
    expect(new Set(team.members.map((member) => member.name)).size).toBe(4);
  });

  it("picks names for the case's language, and English ones for any other", () => {
    expect(buildChallengeTeam({ language: "pt-BR", seed: "a" })).toStrictEqual(
      buildChallengeTeam({ language: "pt", seed: "a" }),
    );

    expect(buildChallengeTeam({ language: "ja", seed: "a" })).toStrictEqual(
      buildChallengeTeam({ language: "en", seed: "a" }),
    );
  });

  it("gives different plans different teams", () => {
    const teams = ["plan-1", "plan-2", "plan-3", "plan-4"].map(
      (seed) => buildChallengeTeam({ language: "en", seed }).members[0]?.name,
    );

    expect(new Set(teams).size).toBeGreaterThan(1);
  });
});

describe(getChallengeNames, () => {
  const slots = challengeCaseFixture().team;

  it("names colleagues from the team in order and the AI by its role", () => {
    const team = { language: "en", members: [{ name: "Priya" }, { name: "Marcus" }] };

    expect(getChallengeNames({ slots, team })).toStrictEqual({
      ai: "AI assistant",
      data: "Priya",
      product: "Marcus",
    });
  });

  it("uses roles when there's no team", () => {
    expect(getChallengeNames({ slots, team: null })).toStrictEqual({
      ai: "AI assistant",
      data: "Data scientist",
      product: "Product manager",
    });
  });
});

describe(fillChallengeNames, () => {
  it("fills known names and leaves anything else as written", () => {
    expect(fillChallengeNames("Tell {{product}} and {{nobody}}.", { product: "Rui" })).toBe(
      "Tell Rui and {{nobody}}.",
    );
  });
});
