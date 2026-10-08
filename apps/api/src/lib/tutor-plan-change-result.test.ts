import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { describe, expect, it } from "vitest";
import { toPlanChangeModelResult } from "./tutor-plan-change-result";

const CHANGE: PlanChangeView = {
  behind: null,
  canUndo: false,
  createdAt: "2026-10-08T12:00:00.000Z",
  days: null,
  effect: {
    areaStarts: [{ after: "2026-10-07", area: "Língua Inglesa", before: "2026-10-08" }],
    endDateAfter: "2027-01-10",
    endDateBefore: "2027-01-10",
    lessonsAdded: 4,
    lessonsRemoved: 2,
    weeklyEvents: { after: 6, before: 0, kind: "mock" },
  },
  id: "019c9bd7-bf11-73cb-9cc8-fe371298190d",
  kind: "edited",
  lessonsSkipped: 0,
  officialDate: null,
  operations: [
    { kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] },
    {
      areas: ["Ciências da Natureza", "Língua Inglesa"],
      kind: "focusAreas",
      parts: [{ area: "Ciências da Natureza", name: "Biologia", skillIds: ["skill"] }],
    },
  ],
  reason: null,
  seen: false,
  source: "planEdit",
  status: "proposed",
  todaySession: null,
};

describe(toPlanChangeModelResult, () => {
  it("tells the buddy what the change does as the card says it, never the asked-for intent", () => {
    expect(
      toPlanChangeModelResult({
        cautions: [],
        change: CHANGE,
        leftOut: [],
        replaced: [],
        status: "proposed",
      }),
    ).toStrictEqual({
      cautions: [],
      changes:
        "Sunday: rest day, nothing planned; more time and depth for Biologia, Língua Inglesa; weekly mocks move from Sunday to Saturday",
      effect: {
        areaStarts: [
          {
            area: "Língua Inglesa",
            firstLessonNow: "2026-10-08",
            firstLessonWithChange: "2026-10-07",
          },
        ],
        endDateAfter: "2027-01-10",
        endDateBefore: "2027-01-10",
        lessonsAdded: 4,
        lessonsRemoved: 2,
      },
      leftOut: [],
      officialExamDate: null,
      status: "proposed",
    });
  });
});
