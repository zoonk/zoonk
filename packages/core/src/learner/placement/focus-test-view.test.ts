import { describe, expect, it } from "vitest";
import { type PlanChangeView } from "../../plans/plan-view-contract";
import { type FocusRow } from "./focus-test-contract";
import { type FocusPlan, toFocus } from "./focus-test-view";

const ROWS: FocusRow[] = ["Direito", "Português"].map((name) => ({
  areas: [name],
  part: null,
  reason: "answers",
  subject: { key: name, name, shortName: null },
}));

const PROPOSAL: PlanChangeView = {
  behind: null,
  canApply: true,
  canUndo: false,
  createdAt: "2026-11-11T12:00:00.000Z",
  days: null,
  effect: null,
  examDocument: "notice",
  id: "019c9bd7-bf11-73cb-9cc8-fe371298190d",
  kind: "edited",
  lessonsSkipped: 0,
  officialDate: null,
  operations: [{ areas: ["Direito", "Português"], kind: "focusAreas" }],
  reason: null,
  seen: false,
  source: "focusTest",
  status: "proposed",
  todaySession: null,
};

const SHORT: FocusPlan = {
  declined: false,
  focusAreas: [],
  handPicked: false,
  proposal: null,
  timeSaved: true,
  timeShort: true,
};

describe(toFocus, () => {
  it.each([
    ["ifTimeShort", { ...SHORT, proposal: PROPOSAL, timeSaved: false, timeShort: false }],
    [null, { ...SHORT, proposal: PROPOSAL, timeShort: false }],
    ["proposed", { ...SHORT, declined: true, proposal: PROPOSAL }],
    ["current", { ...SHORT, focusAreas: ["Português", "Direito"], handPicked: true }],
    ["handPicked", { ...SHORT, declined: true, focusAreas: ["Ética"], handPicked: true }],
    ["declined", { ...SHORT, declined: true, focusAreas: ["Ética"] }],
    ["suggested", { ...SHORT, focusAreas: ["Ética"] }],
    ["suggested", SHORT],
  ] as const)("reads %s from the plan's focus and the test's proposals", (state, plan) => {
    const focus = toFocus({ plan, rows: ROWS });

    expect(focus?.state ?? null).toBe(state);
    expect(focus?.proposal ?? null).toBe(state === "proposed" ? PROPOSAL : null);
  });

  it("shows no focus without rows", () => {
    expect(toFocus({ plan: SHORT, rows: [] })).toBeNull();
  });
});
