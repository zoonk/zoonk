import { NOTHING_REACHED } from "@zoonk/core/sessions/reached";
import { describe, expect, it } from "vitest";
import { mergeReached } from "./merge-reached";

const YELLOW_1 = { color: "yellow", level: 1 } as const;
const YELLOW_2 = { color: "yellow", level: 2 } as const;

describe(mergeReached, () => {
  it("keeps what an earlier count reached when a later one reaches nothing new", () => {
    expect(mergeReached({ energy: 60, level: YELLOW_1 }, NOTHING_REACHED)).toStrictEqual({
      energy: 60,
      level: YELLOW_1,
    });
  });

  it("takes the latest level and the highest tenth of Energy", () => {
    expect(
      mergeReached({ energy: 80, level: YELLOW_1 }, { energy: 70, level: YELLOW_2 }),
    ).toStrictEqual({ energy: 80, level: YELLOW_2 });
  });

  it("reaches nothing when no count did", () => {
    expect(mergeReached(NOTHING_REACHED, NOTHING_REACHED)).toStrictEqual(NOTHING_REACHED);
  });
});
