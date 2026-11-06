import { describe, expect, it } from "vitest";
import { listEndsBeforeLessons } from "./ends-before-lessons";
import { fromIsoDate } from "./plan-calendar";

function filed(key: string, skillId: string, date: string) {
  return {
    key,
    kind: "lesson" as const,
    lessonId: key,
    phase: 1,
    scheduledFor: fromIsoDate(date),
    skillId,
    status: "todo" as const,
  };
}

describe(listEndsBeforeLessons, () => {
  const end = fromIsoDate("2026-10-18");
  const ends = new Map([[0, end]]);

  const input = {
    graph: {
      phases: [],
      skills: [
        { phase: 0, skillId: "arrival" },
        { phase: 1, skillId: "renting" },
      ],
    },
    lessons: [],
  } as unknown as Parameters<typeof listEndsBeforeLessons>[0]["input"];

  it("reads a lesson filed under the next phase by its own skill's phase", () => {
    const items = [filed("a", "arrival", "2026-10-19"), filed("b", "renting", "2026-10-20")];

    expect(
      listEndsBeforeLessons({ ends, input, items, units: [{ depth: false, key: "a" }] }),
    ).toStrictEqual([0]);
  });

  it("leaves a phase's end to a later course level's lesson on its skill", () => {
    const items = [filed("a", "arrival", "2026-10-19")];

    const course = {
      ...input,
      lessons: [{ courseOrder: { phase: 1, position: 4 }, lessonId: "a" }],
    } as unknown as typeof input;

    expect(
      listEndsBeforeLessons({ ends, input: course, items, units: [{ depth: false, key: "a" }] }),
    ).toStrictEqual([]);
  });

  it("lets depth a plan short on time studies later come after the challenge", () => {
    const items = [filed("a", "arrival", "2026-10-19"), filed("b", "renting", "2026-10-20")];

    expect(
      listEndsBeforeLessons({ ends, input, items, units: [{ depth: true, key: "a" }] }),
    ).toStrictEqual([]);
  });
});
