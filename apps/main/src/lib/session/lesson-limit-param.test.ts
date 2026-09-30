import { type LessonLimit } from "@zoonk/learn/help-limit";
import { describe, expect, it } from "vitest";
import { readLessonLimitParam, toLessonLimitParam } from "./lesson-limit-param";

describe(toLessonLimitParam, () => {
  it.each<[LessonLimit, LessonLimit]>([
    [
      { period: "total", status: "limitReached", tier: "guest" },
      { period: "total", status: "limitReached", tier: "guest" },
    ],
    [
      { period: "day", status: "limitReached", tier: "free" },
      { period: "day", status: "limitReached", tier: "free" },
    ],
    [
      { period: "month", status: "limitReached", tier: "free" },
      { period: "month", status: "limitReached", tier: "free" },
    ],
    [
      { period: "day", status: "limitReached", tier: "plus" },
      { period: "day", status: "limitReached", tier: "plus" },
    ],
    [
      { retryAfterSeconds: 300, status: "slowDown" },
      { retryAfterSeconds: 300, status: "slowDown" },
    ],
    // What the notice says only depends on these; a guest's daily budget reads like their lessons.
    [
      { period: "day", status: "limitReached", tier: "guest" },
      { period: "total", status: "limitReached", tier: "guest" },
    ],
  ])("keeps what the notice needs to say through the URL: %o", (limit, read) => {
    expect(readLessonLimitParam(toLessonLimitParam(limit))).toStrictEqual(read);
  });
});

describe(readLessonLimitParam, () => {
  it.each([
    undefined,
    "",
    "free",
    "slow-down-",
    "slow-down-soon",
    "slow-down--5",
    ["guest", "plus"],
  ])("reads %o as no limit", (value) => {
    expect(readLessonLimitParam(value)).toBeNull();
  });
});
