import { describe, expect, it } from "vitest";
import { type PlannedTime, holdUnwrittenTime } from "./unwritten-time";

function hold(lessons: PlannedTime[], room: number) {
  return holdUnwrittenTime({ lessons, room, unwritten: [{ minutes: 12.5, position: 9 }] }).map(
    ({ held, reached }) => ({ held, reached }),
  );
}

describe(holdUnwrittenTime, () => {
  it("gives the written lessons before an unwritten one the room first", () => {
    expect(hold([{ minutes: 6, position: 1 }], 10)).toStrictEqual([{ held: 4, reached: true }]);
  });

  it("reaches no unwritten lesson once the lessons before it take the room", () => {
    expect(hold([{ minutes: 8, position: 1 }], 8)).toStrictEqual([{ held: 0, reached: false }]);

    expect(
      hold(
        [
          { minutes: 6, position: 1 },
          { minutes: 6, position: 2 },
        ],
        10,
      ),
    ).toStrictEqual([{ held: 0, reached: false }]);
  });

  it("leaves the lessons after an unwritten one what it doesn't hold", () => {
    expect(hold([{ minutes: 3, position: 12 }], 25)).toStrictEqual([{ held: 12.5, reached: true }]);
  });
});
