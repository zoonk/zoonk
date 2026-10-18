import { type CourseLevel } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { getPlacementConfirmedBand, pickPlacementListeningAreas } from "./level-listening-starts";

describe(getPlacementConfirmedBand, () => {
  const skills: { band: CourseLevel | null; id: string }[] = [
    { band: "beginner", id: "words" },
    { band: "beginner", id: "sentences" },
    { band: "beginner", id: "agreement" },
    { band: "intermediate", id: "references" },
    { band: "intermediate", id: "paragraphs" },
    { band: null, id: "unbanded" },
  ];

  const confirmed = (known: string[], missed: string[] = []) =>
    getPlacementConfirmedBand({
      knownSkillIds: new Set(known),
      missedSkillIds: new Set(missed),
      skills,
    });

  it("is the highest band whose text skills placement found more known than missed", () => {
    expect(confirmed(["words", "sentences", "references"], ["agreement", "paragraphs"])).toBe(
      "beginner",
    );

    expect(confirmed(["words", "references"])).toBe("intermediate");
  });

  it("is a band placement confirmed even when it never asked the ones below it", () => {
    expect(confirmed(["references"])).toBe("intermediate");
  });

  it("is none when placement missed as many of a band's skills as it confirmed", () => {
    expect(confirmed(["words"], ["sentences"])).toBeNull();
  });

  it("never counts a skill the Library gave no band", () => {
    expect(confirmed(["unbanded"])).toBeNull();
  });
});

describe(pickPlacementListeningAreas, () => {
  const graph = {
    phases: [
      { milestone: null, name: "Basics" },
      { milestone: null, name: "Deeper" },
    ],
    skills: [
      { area: "Listening", lessons: 2, name: "Sounds", phase: 0, skillId: "sounds", weight: null },
      { area: "Listening", lessons: 2, name: "Talks", phase: 0, skillId: "talks", weight: null },
      {
        area: "Listening",
        lessons: 2,
        name: "Lectures",
        phase: 1,
        skillId: "lectures",
        weight: null,
      },
      { area: "Reading", lessons: 2, name: "Words", phase: 0, skillId: "words", weight: null },
    ],
  };

  const pick = ({
    chosen = [],
    confirmedBand,
    soundsBand = "beginner",
  }: {
    chosen?: string[];
    confirmedBand: CourseLevel | null;
    soundsBand?: CourseLevel;
  }) =>
    pickPlacementListeningAreas({
      bands: new Map<string, CourseLevel>([
        ["sounds", soundsBand],
        ["talks", "beginner"],
        ["lectures", "intermediate"],
      ]),
      chosen: new Set(chosen),
      confirmedBand,
      graph,
      listening: new Set(["sounds", "talks", "lectures"]),
      prerequisites: new Map([["lectures", ["sounds"]]]),
    });

  it("starts a listening area past its basics when they sit in the band placement confirmed", () => {
    expect(pick({ confirmedBand: "beginner" })).toStrictEqual(["Listening"]);
    expect(pick({ confirmedBand: "intermediate" })).toStrictEqual(["Listening"]);
  });

  it("leaves an area whose basics sit above the confirmed band", () => {
    expect(pick({ confirmedBand: "beginner", soundsBand: "intermediate" })).toStrictEqual([]);
  });

  it("leaves every area when placement confirmed no band past the overview", () => {
    expect(pick({ confirmedBand: null })).toStrictEqual([]);
    expect(pick({ confirmedBand: "overview" })).toStrictEqual([]);
  });

  it("leaves an area whose start the learner chose", () => {
    expect(pick({ chosen: ["Listening"], confirmedBand: "beginner" })).toStrictEqual([]);
  });
});
