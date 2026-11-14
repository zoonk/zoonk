import { describe, expect, it } from "vitest";
import { type PlanChangeView } from "../../plans/plan-view-contract";
import { type FocusRow } from "./focus-test-contract";
import { type FocusPlan, toFocus } from "./focus-test-view";

const SUBJECTS = [
  { areas: ["Direito"], key: "Direito", name: "Direito", shortName: null },
  { areas: ["Português"], key: "Português", name: "Português", shortName: null },
  {
    areas: ["Ética geral", "Ética no serviço público"],
    key: "Ética na Administração Pública",
    name: "Ética na Administração Pública",
    shortName: "Ética",
  },
];

const ROWS: FocusRow[] = SUBJECTS.slice(0, 2).map(({ areas, ...subject }) => ({ areas, subject }));

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
  quote: null,
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
    const focus = toFocus({ plan, rows: ROWS, subjects: SUBJECTS });

    expect(focus?.state ?? null).toBe(state);
    expect(focus?.proposal ?? null).toBe(state === "proposed" ? PROPOSAL : null);
  });

  it("shows no focus without rows", () => {
    expect(toFocus({ plan: SHORT, rows: [], subjects: SUBJECTS })).toBeNull();
  });

  it("lists the subjects the waiting proposal names, whatever the test would suggest now", () => {
    const proposal: PlanChangeView = {
      ...PROPOSAL,
      operations: [
        {
          areas: ["Ética no serviço público", "Informática", "Ética geral", "Direito"],
          kind: "focusAreas",
        },
      ],
    };

    const focus = toFocus({ plan: { ...SHORT, proposal }, rows: ROWS, subjects: SUBJECTS });

    expect(focus).toStrictEqual({
      proposal,
      rows: [
        {
          areas: ["Ética geral", "Ética no serviço público"],
          subject: {
            key: "Ética na Administração Pública",
            name: "Ética na Administração Pública",
            shortName: "Ética",
          },
        },
        {
          areas: ["Informática"],
          subject: { key: "Informática", name: "Informática", shortName: null },
        },
        { areas: ["Direito"], subject: { key: "Direito", name: "Direito", shortName: null } },
      ],
      state: "proposed",
    });
  });

  it("lists a waiting proposal's subjects when the test suggests nothing now", () => {
    const focus = toFocus({ plan: { ...SHORT, proposal: PROPOSAL }, rows: [], subjects: SUBJECTS });

    expect(focus?.rows.map((row) => row.subject.name)).toStrictEqual(["Direito", "Português"]);
  });
});
