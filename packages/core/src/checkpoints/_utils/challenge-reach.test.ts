import { describe, expect, it } from "vitest";
import { type ChallengeReachItem, isChallengeReached } from "./challenge-reach";

const lesson: ChallengeReachItem = { id: "lesson", kind: "lesson", position: 0, status: "todo" };
const boss: ChallengeReachItem = { id: "boss", kind: "boss", position: 1, status: "todo" };

describe(isChallengeReached, () => {
  it.each(["done", "skipped", "testedOut"] as const)(
    "reaches a challenge after %s lessons independently of its estimate",
    (status) => {
      expect(isChallengeReached({ boss, items: [{ ...lesson, status }, boss] })).toBe(true);
    },
  );

  it("waits for every todo teaching item before it, including an unwritten stand-in", () => {
    expect(isChallengeReached({ boss, items: [lesson, boss] })).toBe(false);
    expect(isChallengeReached({ boss, items: [{ ...lesson, kind: "chapter" }, boss] })).toBe(false);
  });

  it("allows the day walk to place its lessons ahead without changing real reach", () => {
    expect(isChallengeReached({ ahead: new Set(["lesson"]), boss, items: [lesson, boss] })).toBe(
      true,
    );

    expect(isChallengeReached({ boss, items: [lesson, boss] })).toBe(false);
  });

  it("does not wait for lessons after its position or another challenge", () => {
    expect(
      isChallengeReached({
        boss,
        items: [{ ...boss, id: "earlier", position: 0 }, boss, { ...lesson, position: 2 }],
      }),
    ).toBe(true);
  });

  it("never offers a finished challenge", () => {
    expect(isChallengeReached({ boss: { ...boss, status: "done" }, items: [] })).toBe(false);
  });
});
