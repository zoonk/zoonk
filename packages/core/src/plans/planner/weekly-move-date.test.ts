import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { isWeeklyMoveDateAllowed } from "./weekly-move-date";

describe(isWeeklyMoveDateAllowed, () => {
  it.each([
    { allowed: false, to: "2026-10-04", today: "2026-09-28" },
    { allowed: true, to: "2026-10-05", today: "2026-09-28" },
    { allowed: false, to: "2026-10-04", today: "2026-10-04" },
    { allowed: true, to: "2026-10-05", today: "2026-10-04" },
    { allowed: false, to: "2026-10-05", today: "2026-10-05" },
    { allowed: true, to: "2026-10-12", today: "2026-10-05" },
    { allowed: true, to: "2026-10-14", today: "2026-10-05" },
    { allowed: true, to: "2027-01-04", today: "2026-12-31" },
  ])("allows $to from $today: $allowed", ({ allowed, to, today }) => {
    expect(isWeeklyMoveDateAllowed({ to: fromIsoDate(to), today: fromIsoDate(today) })).toBe(
      allowed,
    );
  });
});
