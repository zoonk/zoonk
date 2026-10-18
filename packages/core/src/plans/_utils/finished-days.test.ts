import { describe, expect, it } from "vitest";
import { listFinishedDays } from "./finished-days";

function item(fields: {
  completedAt: Date | null;
  id: string;
  kind?: "boss" | "lesson";
  status?: "done" | "todo";
}) {
  return { kind: "lesson" as const, status: "done" as const, ...fields };
}

// A lesson finished at 23:30 in São Paulo is still that day there, though it's the next in UTC.
const LATE_EVENING = new Date("2026-10-13T02:30:00Z");

describe(listFinishedDays, () => {
  it("dates each finished lesson by the learner's own day", () => {
    const items = [item({ completedAt: LATE_EVENING, id: "late" })];

    expect(listFinishedDays({ items, timeZone: "America/Sao_Paulo" })).toStrictEqual(
      new Map([["late", new Date("2026-10-12T00:00:00Z")]]),
    );

    expect(listFinishedDays({ items, timeZone: "UTC" })).toStrictEqual(
      new Map([["late", new Date("2026-10-13T00:00:00Z")]]),
    );
  });

  it("leaves out work not done, challenges, and a finished lesson without its time", () => {
    const items = [
      item({ completedAt: null, id: "todo", status: "todo" }),
      item({ completedAt: LATE_EVENING, id: "boss", kind: "boss" }),
      item({ completedAt: null, id: "legacy" }),
    ];

    expect(listFinishedDays({ items, timeZone: "UTC" })).toStrictEqual(new Map());
  });
});
