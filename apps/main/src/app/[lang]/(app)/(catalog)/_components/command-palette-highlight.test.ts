import { describe, expect, it } from "vitest";
import { keepsRowsThrough } from "./command-palette-highlight";

function group(...ids: string[]) {
  return { items: ids.map((id) => ({ id })) };
}

/** "settings" before the learner was read: the places every learner has. */
const UNREAD = [group("settings", "appearance", "language")];

describe("the palette's rows through its highlighted one", () => {
  it("keeps the rows through the highlighted one when the new rows land below it", () => {
    const learner = [
      group("settings", "profile", "memory", "subscription", "appearance", "language"),
    ];

    expect(keepsRowsThrough({ highlighted: 0, next: learner, shown: UNREAD })).toBe(true);
  });

  it("moves them when a row lands above the highlighted one, even in an earlier group", () => {
    const learner = [group("continue"), group("settings", "appearance", "language")];

    expect(keepsRowsThrough({ highlighted: 0, next: learner, shown: UNREAD })).toBe(false);
  });

  it("moves them when a row lands between the top and a highlighted row further down", () => {
    const learner = [group("settings", "profile", "appearance", "language")];

    expect(keepsRowsThrough({ highlighted: 2, next: learner, shown: UNREAD })).toBe(false);
    expect(keepsRowsThrough({ highlighted: 1, next: learner, shown: UNREAD })).toBe(false);
    expect(keepsRowsThrough({ highlighted: 0, next: learner, shown: UNREAD })).toBe(true);
  });

  it("moves them when a row above the highlighted one goes away", () => {
    const fewer = [group("appearance", "language")];

    expect(keepsRowsThrough({ highlighted: 1, next: fewer, shown: UNREAD })).toBe(false);
  });

  it("keeps them when nothing is highlighted", () => {
    expect(keepsRowsThrough({ highlighted: -1, next: [group("continue")], shown: UNREAD })).toBe(
      true,
    );
  });
});
