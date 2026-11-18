import { describe, expect, it } from "vitest";
import { getDoneChapters } from "./done-chapters";

describe("subject chapter progress", () => {
  it("counts chapters tested out of along with chapters studied", () => {
    const studied = { known: false, state: "done" } as const;
    const skipped = { known: true, state: "done" } as const;
    const current = { known: false, state: "current" } as const;
    const upcoming = { known: false, state: "upcoming" } as const;

    const chapters = [
      studied,
      skipped,
      studied,
      skipped,
      current,
      ...Array.from({ length: 5 }, () => upcoming),
    ];

    expect(getDoneChapters(chapters)).toStrictEqual([studied, skipped, studied, skipped]);
  });
});
