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
      {
        availableAt: "2026-11-20T12:00:00.000Z",
        period: "rolling30Days",
        status: "limitReached",
        tier: "free",
      },
      {
        availableAt: "2026-11-20T12:00:00.000Z",
        period: "rolling30Days",
        status: "limitReached",
        tier: "free",
      },
    ],
    [
      { period: "day", status: "limitReached", tier: "plus" },
      { period: "day", status: "limitReached", tier: "plus" },
    ],
    [
      { retryAfterSeconds: 300, status: "slowDown" },
      { retryAfterSeconds: 300, status: "slowDown" },
    ],
    [{ status: "signUpRequired" }, { status: "signUpRequired" }],
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
    "free-opens-",
    "free-opens-soon",
    "free-opens-99999999999999999",
    ["guest", "plus"],
  ])("reads %o as no limit", (value) => {
    expect(readLessonLimitParam(value)).toBeNull();
  });
});
