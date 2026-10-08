import {
  CHALLENGE_STRONG_PATH,
  CHALLENGE_WEAK_PATH,
  challengeCaseFixture,
} from "@zoonk/testing/fixtures/challenge-contents";
import { describe, expect, it } from "vitest";
import { walkChallenge } from "./challenge-graph";
import { getChallengeDebrief, getChallengeMeters, gradeChallengePath } from "./challenge-run";

const content = challengeCaseFixture();

function stepsOf(choiceIds: string[]) {
  const walk = walkChallenge(content, choiceIds);
  return walk.status === "invalid" ? [] : walk.steps;
}

describe(gradeChallengePath, () => {
  it("scores strong decisions as right and ends at their outcome", () => {
    const result = gradeChallengePath(content, CHALLENGE_STRONG_PATH);

    expect(result?.score).toBe(1);
    expect(result?.isCorrect).toBe(true);
    expect(result?.ending.id).toBe("shipped");
  });

  it("scores weak decisions as missed, but the case still ends", () => {
    const result = gradeChallengePath(content, CHALLENGE_WEAK_PATH);

    expect(result?.score).toBe(0);
    expect(result?.isCorrect).toBe(false);
    expect(result?.ending.id).toBe("too-early");
  });

  it("gives half credit for fair decisions and counts half as right", () => {
    const result = gradeChallengePath(content, ["ask-sample", "explain-p", "wait-more"]);

    expect(result?.score).toBe(0.5);
    expect(result?.isCorrect).toBe(true);
  });

  it("returns null for a path that hasn't ended or isn't in the case", () => {
    expect(gradeChallengePath(content, ["ask-ai"])).toBeNull();
    expect(gradeChallengePath(content, ["ship", "ask-ai"])).toBeNull();
  });
});

describe(getChallengeMeters, () => {
  it("starts every meter where the case sets it", () => {
    expect(
      getChallengeMeters(content, []).map(({ change, id, value }) => ({ change, id, value })),
    ).toStrictEqual([
      { change: 0, id: "risk", value: 70 },
      { change: 0, id: "patience", value: 80 },
    ]);
  });

  it("adds each decision's effects and keeps the last one's change", () => {
    const meters = getChallengeMeters(content, stepsOf(["ask-ai", "explain-plain"]));

    expect(meters.map(({ change, id, value }) => ({ change, id, value }))).toStrictEqual([
      { change: -10, id: "risk", value: 30 },
      { change: -5, id: "patience", value: 65 },
    ]);
  });

  it("keeps meters between 0 and 100", () => {
    const meters = getChallengeMeters(content, stepsOf(["launch", "keep-live"]));

    expect(meters.find((meter) => meter.id === "risk")?.value).toBe(100);
  });
});

describe(getChallengeDebrief, () => {
  it("collects what went well and suggests no practice when nothing needs work", () => {
    const debrief = getChallengeDebrief(content, stepsOf(CHALLENGE_STRONG_PATH));

    expect(debrief.good.map((note) => note.skill)).toStrictEqual([
      "significance",
      "explaining",
      "sample",
    ]);

    expect(debrief.improve).toStrictEqual([]);
    expect(debrief.practice).toBeNull();

    expect(debrief.skills.map((skill) => skill.id)).toStrictEqual([
      "sample",
      "significance",
      "explaining",
    ]);
  });

  it("suggests practice for the skill with the most to improve", () => {
    const debrief = getChallengeDebrief(content, stepsOf(["ask-sample", "explain-p", "wait-more"]));

    expect(debrief.improve.map((note) => note.skill)).toStrictEqual(["explaining", "significance"]);

    expect(debrief.practice?.id).toBe("significance");
  });
});
