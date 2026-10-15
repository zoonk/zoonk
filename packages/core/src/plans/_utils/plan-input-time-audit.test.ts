import { describe, expect, it } from "vitest";
import { type BuildPlanInput } from "../planner/build-plan";
import { getMissedMockRescueDays } from "../planner/mock-rescue-input";
import { type ExistingPlanItem, getItemKey } from "../planner/plan-items";
import { parsePlanSettings } from "../planner/plan-state";
import { type PlanCarrySnapshot } from "./carried-lessons";
import { getPlanInputKeys, readPlacementFacts } from "./plan-input-classes";

/**
 * The time-input audit: every branch of a run's input that reads today is keyed (scope or
 * placement) or declared no news. Raw today is in no key; what the clock does to the work (the
 * work earlier days left, a missed mock's rescue) is placement.
 */

const day = (date: string) => new Date(`${date}T00:00:00Z`);

function lesson(
  id: string,
  scheduledFor: string,
  status: ExistingPlanItem["status"] = "todo",
): ExistingPlanItem {
  return {
    chapterId: "chapter-a",
    completedAt: status === "done" ? day(scheduledFor) : null,
    id,
    kind: "lesson",
    lessonId: id,
    phase: 0,
    position: 0,
    scheduledFor: day(scheduledFor),
    skillId: "fractions",
    status,
    titleSnapshot: id,
  };
}

const items = [
  lesson("a", "2026-10-12", "done"),
  lesson("b", "2026-10-14"),
  lesson("c", "2026-10-20"),
];

const learn: BuildPlanInput = {
  goal: { dailyMinutes: 30, kind: "learn", targetDate: day("2026-12-18") },
  graph: {
    phases: [{ milestone: null, name: "Basics" }],
    skills: [
      { area: "Math", lessons: 3, name: "Fractions", phase: 0, skillId: "fractions", weight: 1 },
    ],
  },
  items,
  knownSkillIds: new Set(),
  lessons: ["a", "b", "c"].map((lessonId) => ({
    chapterId: "chapter-a",
    lessonId,
    minutes: 5,
    skillIds: ["fractions"],
    title: lessonId,
  })),
  missedSkillIds: new Set(),
  mockMinutes: 30,
  mode: "automatic",
  paceFactor: 1,
  prerequisites: new Map(),
  readiness: new Map([
    [
      "fractions",
      { reps: 2, retrievabilityAtTarget: 0.6, stability: 4, state: "learning" as const },
    ],
  ]),
  settings: parsePlanSettings({ startDate: "2026-10-12" }),
  today: day("2026-10-12"),
};

const nothingGiven: PlanCarrySnapshot = { previous: { lessonIds: [] }, settle: null };

/** The keys a run on `today` reads, as an Open's gate or a layout would read them. */
function keysOn({
  input = learn,
  snapshot = nothingGiven,
  today,
}: {
  input?: BuildPlanInput;
  snapshot?: PlanCarrySnapshot;
  today: string;
}) {
  const at = { ...input, today: day(today) };

  return getPlanInputKeys({
    input: at,
    items: at.items.map((item) => ({ key: getItemKey(item), status: item.status })),
    placement: readPlacementFacts({ items: at.items, snapshot, today: at.today }),
  });
}

describe("time-input audit", () => {
  it("reads a day that only begins, with nothing overdue, as no news", () => {
    expect(keysOn({ today: "2026-10-13" })).toStrictEqual(keysOn({ today: "2026-10-12" }));
    expect(keysOn({ today: "2026-10-14" })).toStrictEqual(keysOn({ today: "2026-10-12" }));
  });

  it("reads work an earlier day left as placement news, never scope", () => {
    const before = keysOn({ today: "2026-10-14" });
    const after = keysOn({ today: "2026-10-15" });

    expect(after.scope).toBe(before.scope);
    expect(after.placement).not.toBe(before.placement);
  });

  it("reads an unfinished offer the plan has after today as placement news", () => {
    const offered: PlanCarrySnapshot = { previous: { lessonIds: ["c"] }, settle: null };
    const before = keysOn({ today: "2026-10-13" });
    const after = keysOn({ snapshot: offered, today: "2026-10-13" });

    expect(after.scope).toBe(before.scope);
    expect(after.placement).not.toBe(before.placement);

    // Once today settled it, it isn't left again.
    const settled: PlanCarrySnapshot = {
      ...offered,
      settle: { createdAt: day("2026-10-13"), itemIds: [] },
    };

    expect(keysOn({ snapshot: settled, today: "2026-10-13" })).toStrictEqual(before);
  });

  it("reads a readiness change from practice alone as no news (D6)", () => {
    const practiced = {
      ...learn,
      readiness: new Map([
        [
          "fractions",
          { reps: 9, retrievabilityAtTarget: 0.95, stability: 30, state: "solid" as const },
        ],
      ]),
    };

    expect(keysOn({ input: practiced, today: "2026-10-13" })).toStrictEqual(
      keysOn({ today: "2026-10-13" }),
    );
  });

  it.each([
    { knownSkillIds: new Set(["fractions"]) },
    { missedSkillIds: new Set(["fractions"]) },
    { answeredWrongSkillIds: new Set(["fractions"]) },
    { strongAreas: new Set(["Math"]) },
  ])("reads a change in what the learner showed they know or miss as scope news (%j)", (change) => {
    const before = keysOn({ today: "2026-10-13" });
    const after = keysOn({ input: { ...learn, ...change }, today: "2026-10-13" });

    expect(after.scope).not.toBe(before.scope);
  });

  /**
   * An exam from Oct 12 to Jan 12 at 90 minutes a day, with a regular mock every other week: the
   * days a missed mock gets rescued on move only when the clock passes a mock day (see
   * `getMissedMockRescueDays`, the planner's own rule). The keys follow that rule and nothing else:
   * a day whose rescue is the day before's is no news, one whose rescue moved is placement news.
   */
  const exam: BuildPlanInput = {
    ...learn,
    fullMockMinutes: 330,
    goal: { dailyMinutes: 90, kind: "exam", targetDate: day("2027-01-12") },
    items: [],
    mockMinutes: 165,
  };

  const days = Array.from({ length: 28 }, (_, offset) =>
    new Date(day("2026-10-13").getTime() + offset * 86_400_000).toISOString().slice(0, 10),
  );

  const rollovers = days.slice(1).map((today, index) => {
    const yesterday = days[index] ?? today;
    const rescue = (date: string) => getMissedMockRescueDays({ ...exam, today: day(date) });

    return {
      after: keysOn({ input: exam, today }),
      before: keysOn({ input: exam, today: yesterday }),
      rescueMoved: rescue(today).join(",") !== rescue(yesterday).join(","),
    };
  });

  it("reads a missed mock's rescue as placement news, and other days as none", () => {
    expect(rollovers.some((rollover) => rollover.rescueMoved)).toBe(true);
    expect(rollovers.some((rollover) => !rollover.rescueMoved)).toBe(true);

    rollovers.forEach(({ after, before, rescueMoved }) => {
      expect(after.scope).toBe(before.scope);
      expect(after.placement !== before.placement).toBe(rescueMoved);
    });
  });
});
