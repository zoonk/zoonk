import { describe, expect, it } from "vitest";
import { type QueueUnit } from "./plan-units";
import { rotateTopics } from "./topic-rotation";

function written(skillId: string, chapter: number, count: number, from = 1): QueueUnit[] {
  return Array.from({ length: count }, (_, index) => ({
    area: "English",
    chapterId: `${skillId}-ch${chapter}`,
    key: `lesson:${skillId}${from + index}`,
    kind: "lesson",
    lessonId: `${skillId}${from + index}`,
    minutes: 4,
    phase: 0,
    skillId,
    title: `${skillId}${from + index}`,
  }));
}

function standIn(skillId: string, lessons: number, phase = 0): QueueUnit {
  return {
    area: "English",
    chapterId: null,
    key: `skill:${skillId}`,
    kind: "lesson",
    lessonId: null,
    lessons,
    minutes: lessons * 4,
    phase,
    skillId,
    title: skillId,
  };
}

function boss(phase: number): QueueUnit {
  return {
    area: "English",
    chapterId: null,
    key: `boss:${phase}`,
    kind: "boss",
    lessonId: null,
    minutes: 20,
    phase,
    skillId: null,
    title: `Challenge ${phase}`,
  };
}

function topicsOf(units: readonly QueueUnit[]): string {
  return units.map((unit) => (unit.kind === "boss" ? "|" : unit.skillId)).join("");
}

describe(rotateTopics, () => {
  it("takes turns of two lessons between three topics, each staying for one chapter", () => {
    const units = ["a", "b", "c", "d"].map((skillId) => standIn(skillId, 20));

    const order = topicsOf(rotateTopics({ kept: [], prerequisites: new Map(), units }));

    expect(order.slice(0, 30)).toBe("aabbccaabbccaabbccaabbccaabbcc");
    expect(order.slice(30, 42)).toBe("ddaabbddaabb");
    expect(order).toHaveLength(80);
  });

  it("ends a topic's stay where its written chapter ends", () => {
    const units = [
      ...written("a", 1, 4),
      standIn("a", 10),
      ...written("b", 1, 6),
      ...written("c", 1, 6),
      ...written("d", 1, 6),
    ];

    const order = topicsOf(rotateTopics({ kept: [], prerequisites: new Map(), units }));

    expect(order.slice(0, 14)).toBe("aabbccaabbccdd");
  });

  it("keeps each topic's lessons in their own order", () => {
    const units = [...written("a", 1, 3), ...written("a", 2, 3, 4), ...written("b", 1, 2)];

    const placed = rotateTopics({ kept: [], prerequisites: new Map(), units });

    expect(
      placed.filter((unit) => unit.skillId === "a").map((unit) => unit.lessonId),
    ).toStrictEqual(["a1", "a2", "a3", "a4", "a5", "a6"]);
  });

  it("resumes the same turns after a re-plan, counting the lessons already done", () => {
    const units = [
      ...written("a", 1, 9, 2),
      ...written("b", 1, 10),
      ...written("c", 1, 10),
      ...written("d", 1, 10),
    ];

    const done = [{ chapterId: "a-ch1", lessons: 1, skillId: "a" }];

    const placed = rotateTopics({ kept: done, prerequisites: new Map(), units });

    expect(placed.slice(0, 7).map((unit) => unit.lessonId)).toStrictEqual([
      "a2",
      "b1",
      "b2",
      "c1",
      "c2",
      "a3",
      "a4",
    ]);
  });

  it("gives the next topic its turn after finished turns, so no topic waits for a re-plan", () => {
    const units = [
      ...written("a", 1, 8, 3),
      ...written("b", 1, 8, 3),
      ...written("c", 1, 10),
      ...written("d", 1, 10),
    ];

    const done = [
      { chapterId: "a-ch1", lessons: 2, skillId: "a" },
      { chapterId: "b-ch1", lessons: 2, skillId: "b" },
    ];

    const order = topicsOf(rotateTopics({ kept: done, prerequisites: new Map(), units }));

    expect(order.slice(0, 6)).toBe("ccaabb");
  });

  it("opens a topic only once each topic it builds on has had its first stay", () => {
    const units = ["a", "b", "c", "d"].map((skillId) => standIn(skillId, 20));
    const prerequisites = new Map([["b", ["a"]]]);

    const order = topicsOf(rotateTopics({ kept: [], prerequisites, units }));

    expect(order.slice(0, 12)).toBe("aaccddaaccdd");
    expect(order.indexOf("b")).toBeGreaterThan(order.indexOf("a") + 9);
  });

  it("rotates each phase on its own and keeps the challenge after its phase", () => {
    const units = [
      standIn("a", 4),
      standIn("b", 4),
      boss(0),
      standIn("c", 4, 1),
      standIn("d", 4, 1),
      boss(1),
    ];

    const order = topicsOf(rotateTopics({ kept: [], prerequisites: new Map(), units }));

    expect(order).toBe("aabbaabb|ccddccdd|");
  });
});
