import { isDeepStrictEqual } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";
import { type SimPlan } from "./_test-utils/sim/sim-world";
import { toIsoDate } from "./planner/plan-calendar";
import { getItemKey } from "./planner/plan-items";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

// The mistake classifier is a paid model call: a wrong answer whose cause isn't clear is a gap here.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({
  classifyMistakeCause: vi.fn(async () => ({ data: { cause: "gap" } })),
}));

// Vercel Blob is the external store a deleted account's files are removed from.
vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  list: vi.fn(async () => ({ blobs: [], cursor: undefined, hasMore: false })),
}));

const MINUTE = 60_000;

/** Each plan item as a learner sees it, by the fixture's short ids, so two library copies compare. */
function readable(plan: SimPlan, short: (id: string) => string) {
  return plan.items.map((item) => {
    // A quick lesson the Library made during the life has no short id: its title says which.
    const lessonId =
      item.lessonId && short(item.lessonId) === item.lessonId ? item.titleSnapshot : item.lessonId;

    const key = getItemKey({
      ...item,
      lessonId: lessonId ? short(lessonId) : null,
      skillId: item.skillId ? short(item.skillId) : null,
    });

    return `${key}:${item.status}:${item.scheduledFor ? toIsoDate(item.scheduledFor) : "-"}`;
  });
}

/**
 * The pure tier composes the planner the way `computePlan`, `computeChange` and `refreshGoalPlan`
 * do around their database reads (see `sim-planner.ts`): the same life, without sessions, leaves
 * the same plan through both. A difference means that copy drifted from the real composition.
 */
describe("the pure tier plans as the real capabilities do", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 30,
    knownAreas: [],
    pending: [3],
    seed: 7,
    speed: 1,
    start: "2026-10-12",
    steps: [
      { days: 2, kind: "miss" },
      { kind: "change", spec: { area: 0, kind: "focus" }, via: "editor" },
      { count: 1, kind: "land" },
      { kind: "change", spec: { kind: "time", minutes: 45 }, via: "buddy" },
      { days: 1, kind: "miss" },
      { kind: "refresh" },
    ],
    subscribed: false,
    targetInDays: 40,
  };

  /** A life with placement and study days, so sessions and their carry-over are compared too. */
  const STUDY_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    steps: [
      {
        answers: [
          [0, true],
          [1, false],
          [4, true],
          [2, true],
        ],
        kind: "placement",
      },
      { finish: 0.5, kind: "study", misses: [] },
      { finish: 1, kind: "study", misses: [] },
      { days: 1, kind: "miss" },
      { kind: "change", spec: { area: 0, kind: "reduce" }, via: "editor" },
      { finish: 0.25, kind: "study", misses: [] },
      { kind: "refresh" },
    ],
  };

  /**
   * A learner slower than the estimates with two hours a day: enough lessons for everyone's pace,
   * which counts their own, to be trusted along with theirs.
   */
  const SLOW_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    dailyMinutes: 120,
    pending: [],
    speed: 1.5,
    steps: Array.from({ length: 4 }, () => ({ finish: 1, kind: "study", misses: [] }) as const),
  };

  /** A short class test whose plan holds a quick lesson the first study day gives. */
  const QUICK_LESSON_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    dailyMinutes: 15,
    seed: 1000,
    steps: [
      {
        answers: [
          [4, false],
          [1, false],
          [4, true],
          [1, true],
          [2, true],
          [1, true],
          [4, true],
          [3, false],
        ],
        kind: "placement",
      },
      { finish: 1, kind: "study", misses: [] },
      { finish: 0.5, kind: "study", misses: [] },
      { kind: "change", spec: { inDays: 13, kind: "lightWeek" }, via: "buddy" },
    ],
    targetInDays: 10,
  };

  /** A Plus learner past a free exam plan's first days, with a mock that isn't a full review. */
  const PLUS_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    dailyMinutes: 15,
    steps: Array.from({ length: 9 }, () => ({ finish: 0.5, kind: "study", misses: [] }) as const),
    subscribed: true,
    targetInDays: 12,
  };

  /**
   * A language learner whose third day's Today proposes moving the phase dates: they apply it (a
   * change of theirs, today's session following it) or keep their dates.
   */
  const PROPOSAL_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    dailyMinutes: 45,
    pending: [],
    proposals: "apply",
    seed: 1008,
    steps: [
      { finish: 0.75, kind: "study", misses: [] },
      { kind: "refresh" },
      { finish: 1, kind: "study", misses: [] },
      { finish: 1, kind: "study", misses: [] },
      { finish: 1, kind: "study", misses: [] },
    ],
    subscribed: true,
    targetInDays: 73,
  };

  /**
   * A language learner who changes the plan while Today's proposal to move the phase dates waits:
   * the change replaces it, so the learner is never asked to answer it.
   */
  const REPLACED_PROPOSAL_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    dailyMinutes: 15,
    pending: [1, 5, 11],
    seed: 1018,
    steps: [
      { kind: "change", spec: { kind: "restDay", weekday: 1 }, via: "editor" },
      { finish: 1, kind: "study", misses: [] },
      { kind: "change", spec: { area: 0, kind: "focus" }, undo: true, via: "buddy" },
      { kind: "change", spec: { base: 2, choice: "essential", kind: "bases" }, via: "editor" },
      { kind: "change", spec: { bias: "moreExplanation", kind: "practice" }, via: "buddy" },
      { count: 2, kind: "land" },
    ],
    targetInDays: 74,
  };

  /** A career learner who skips an area and undoes it right away. */
  const UNDONE_CHANGE_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    dailyMinutes: 15,
    pending: [1, 12, 13, 15, 24],
    seed: 1005,
    speed: 1.2,
    steps: [
      { finish: 1, kind: "study", misses: [] },
      { kind: "change", spec: { area: 6, kind: "skip" }, undo: true, via: "editor" },
      { finish: 1, kind: "study", misses: [] },
    ],
    targetInDays: 152,
  };

  /**
   * A class test learner who undoes placement's test-outs (lessons the new plan leaves out stay
   * where they were), then a focus through the buddy.
   */
  const UNDONE_TEST_OUT_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    dailyMinutes: 20,
    seed: 1002,
    steps: [
      {
        answers: [
          [3, false],
          [3, true],
          [4, true],
          [0, false],
        ],
        kind: "placement",
        undo: true,
      },
      { finish: 0.5, kind: "study", misses: [] },
      { kind: "change", spec: { area: 0, kind: "focus" }, undo: true, via: "buddy" },
      { finish: 1, kind: "study", misses: [] },
    ],
    targetInDays: 4,
  };

  /**
   * An OAB learner with a skill whose Library chapters sit only in another course: the planner
   * finds no lessons for it, so the Library writes some once it lands on the next day's Today.
   */
  const OTHER_COURSE_LIFE: Omit<SimLife, "fixture"> = {
    ...LIFE,
    dailyMinutes: 120,
    pending: [],
    seed: 1007,
    steps: [
      {
        answers: [
          [33, true],
          [94, true],
          [107, false],
          [21, false],
        ],
        kind: "placement",
      },
      { finish: 0.5, kind: "study", misses: [] },
      { kind: "change", spec: { area: 1, kind: "focus", less: 18 }, via: "editor" },
    ],
    targetInDays: 68,
  };

  /**
   * An IELTS learner whose outlined lessons land after Today's session was built: the session
   * takes them at its end, up to the day's time, and the learner plays half of it.
   */
  const LANDED_TODAY_LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 20,
    knownAreas: [1],
    pending: [9],
    seed: 1001,
    speed: 1.5,
    start: "2026-10-12",
    steps: [
      {
        answers: [
          [6, true],
          [4, false],
          [7, false],
        ],
        kind: "placement",
      },
      { finish: 0.75, kind: "study", misses: [] },
      { kind: "change", spec: { area: 1, kind: "focus" }, via: "editor" },
      { kind: "change", spec: { area: 0, kind: "focus" }, via: "editor" },
      { count: 2, kind: "land" },
      { finish: 0.5, kind: "study", misses: [] },
    ],
    subscribed: false,
    targetInDays: 75,
  };

  /**
   * An IELTS learner whose session was built while a skill of the day waited for its lessons: they
   * land, the plan puts them where their stand-in was, and the session takes them at its end, after
   * lessons the plan has later. The learner plays the session's first half, in its order.
   */
  const STAND_IN_LANDED_LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 30,
    knownAreas: [],
    ownLevel: "intermediate",
    pending: [5, 6, 9],
    seed: 1092,
    speed: 1.2,
    start: "2026-10-12",
    steps: [
      { finish: 1, kind: "study", misses: [] },
      { kind: "refresh" },
      { count: 2, kind: "land" },
      { finish: 0.5, kind: "study", misses: [] },
    ],
    subscribed: false,
    targetInDays: 77,
  };

  /**
   * A class test learner who misses a basic in placement, then says its subject's basics are too
   * basic: from that choice it's a claim to confirm, not a gap (`loadPassedOverClaims`), so after
   * missed days the settling sets its lessons aside like other work that no longer fits.
   */
  const PASSED_OVER_MISS_LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 30,
    knownAreas: [0],
    mockOffers: "focus",
    pending: [],
    proposals: "apply",
    seed: 1114,
    speed: 1.5,
    start: "2026-10-12",
    steps: [
      {
        answers: [
          [0, false],
          [3, true],
          [2, false],
          [6, true],
          [0, true],
          [6, true],
        ],
        kind: "placement",
      },
      { kind: "change", spec: { area: 0, kind: "pastBasics" }, via: "buddy" },
      { finish: 1, kind: "study", misses: [1] },
      { finish: 1, kind: "study", misses: [] },
      { days: 4, kind: "miss" },
      { finish: 1, kind: "study", misses: [5] },
    ],
    subscribed: true,
    targetInDays: 8,
  };

  /**
   * A language learner whose day holds a unit's call after one more lesson: the lesson comes
   * first, and the session isn't over until the call is. The first study day is two days after the
   * start: three would be a welcome back, a lighter day the pure tier doesn't plan.
   */
  const CHALLENGE_DAY_LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 45,
    knownAreas: [],
    pending: [2, 4, 6, 8, 9, 12],
    proposals: "decline",
    seed: 1022,
    speed: 1.2,
    start: "2026-10-13",
    steps: [
      { days: 2, kind: "miss" },
      { finish: 0.5, kind: "study", misses: [] },
      { finish: 0.75, kind: "study", misses: [] },
    ],
    subscribed: false,
    targetInDays: 114,
  };

  // The learner applies Today's move of the phase dates, then picks in the editor the practice mix
  // the plan already has: nothing is set back, since the move changed no setting (`undoSetBack`).
  const KEPT_MOVE_LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 25,
    knownAreas: [],
    pending: [2, 5],
    proposals: "apply",
    seed: 1054,
    speed: 0.8,
    start: "2026-10-12",
    steps: [
      { finish: 1, kind: "study", misses: [3] },
      { kind: "change", spec: { bias: "balanced", kind: "practice" }, via: "editor" },
    ],
    subscribed: false,
    targetInDays: 198,
  };

  // The learner sets their time to 10 minutes and back to 20 in the editor: the second change is
  // the first one's Undo (`undoSetBack`), which gives back the plan as it was, where planning again
  // would lay today out another way.
  const SET_BACK_LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 20,
    knownAreas: [],
    pending: [],
    seed: 1001,
    speed: 1,
    start: "2026-10-12",
    steps: [
      { finish: 1, kind: "study", misses: [] },
      { kind: "change", spec: { kind: "time", minutes: 10 }, via: "editor" },
      { kind: "change", spec: { kind: "time", minutes: 20 }, via: "editor" },
    ],
    subscribed: false,
    targetInDays: 60,
  };

  // A class test learner whose placement left a base with a quick lesson picks that same quick
  // lesson in the editor: it moves no lesson, so only its settings are kept, with no change.
  const BASE_CHOICE_SAVED_LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 30,
    knownAreas: [0],
    pending: [5],
    proposals: "apply",
    seed: 1152,
    speed: 1.2,
    start: "2026-10-12",
    steps: [
      {
        answers: [
          [1, false],
          [6, false],
          [0, true],
          [1, true],
          [0, true],
          [2, true],
          [5, true],
          [0, false],
        ],
        kind: "placement",
      },
      { kind: "change", spec: { base: 1, choice: "quick", kind: "bases" }, via: "editor" },
    ],
    subscribed: true,
    targetInDays: 11,
  };

  // An IELTS learner who says in onboarding they studied English before (or, below, that they know
  // Listening well): its listening starts past the basics (`settleNewPlan`), and practice still
  // asks those skills.
  const STATED_LEVEL_LIFE: Omit<SimLife, "fixture"> = {
    dailyMinutes: 30,
    knownAreas: [],
    ownLevel: "intermediate",
    pending: [],
    seed: 1002,
    speed: 1,
    start: "2026-10-12",
    steps: [
      { finish: 1, kind: "study", misses: [] },
      { days: 1, kind: "miss" },
      { finish: 0.5, kind: "study", misses: [] },
      { kind: "change", spec: { area: 0, kind: "restore" }, via: "editor" },
    ],
    subscribed: false,
    targetInDays: 60,
  };

  const KNOWN_LISTENING_LIFE: Omit<SimLife, "fixture"> = {
    ...STATED_LEVEL_LIFE,
    knownAreas: [0],
    ownLevel: "basic",
  };

  it.each([
    ["career", "changes", LIFE],
    ["language", "changes", LIFE],
    ["class-test", "changes", LIFE],
    ["career", "study days", STUDY_LIFE],
    ["class-test", "study days", STUDY_LIFE],
    ["language", "study days", STUDY_LIFE],
    ["career", "a slow learner's pace", SLOW_LIFE],
    ["class-test", "a quick lesson", QUICK_LESSON_LIFE],
    ["class-test", "a Plus learner", PLUS_LIFE],
    ["language", "an applied proposal", PROPOSAL_LIFE],
    ["language", "a declined proposal", { ...PROPOSAL_LIFE, proposals: "decline" }],
    ["language", "a change while a proposal waits", REPLACED_PROPOSAL_LIFE],
    ["career", "an undone change", UNDONE_CHANGE_LIFE],
    ["class-test", "undone test-outs and change", UNDONE_TEST_OUT_LIFE],
    ["oab", "a skill taught only in another course", OTHER_COURSE_LIFE],
    ["ielts", "lessons landing in today's session", LANDED_TODAY_LIFE],
    ["ielts", "lessons landing for a stand-in today's session skipped", STAND_IN_LANDED_LIFE],
    ["class-test", "a basic missed in placement, then passed over", PASSED_OVER_MISS_LIFE],
    ["language", "a lesson before the day's challenge", CHALLENGE_DAY_LIFE],
    ["language", "an edit that changes nothing after Today's move", KEPT_MOVE_LIFE],
    ["ielts", "an edit that sets back the latest one", SET_BACK_LIFE],
    ["class-test", "a base choice that moves no lesson", BASE_CHOICE_SAVED_LIFE],
    ["ielts", "a level stated in onboarding", STATED_LEVEL_LIFE],
    ["ielts", "a listening subject said known", KNOWN_LISTENING_LIFE],
  ] as const)(
    "for %s (%s)",
    async (fixture, _name, base) => {
      const life = {
        ...base,
        fixture,
        targetInDays:
          fixture === "class-test" && (base === LIFE || base === STUDY_LIFE)
            ? 9
            : base.targetInDays,
      };

      const pure = await runSimLife(life, { trace: true });
      // Compared by the plans and steps each tier left: no rule's check.
      const real = await runSimLifeInDb(life, { rules: [], trace: true });
      const purePlans = pure.plans.map((plan) => readable(plan, pure.library.short));
      const realPlans = real.plans.map((plan) => readable(plan, real.library.short));

      const differs = realPlans.findIndex(
        (plan, index) => !isDeepStrictEqual(plan, purePlans[index]),
      );

      // What each step was, what the checks read it as (a studied day, a run after progress), and
      // whether Today shows a proposal to move the phase dates after it.
      const shown = (events: typeof pure.events) =>
        events.map(({ event, label, waiting }) => {
          const studied = event.kind === "newDay" && event.studied ? " studied" : "";
          const progressed = event.kind === "refresh" && event.progressed ? " progressed" : "";
          const proposal = waiting ? " (proposal waiting)" : "";
          return `${label}: ${event.kind}${studied}${progressed}${proposal}`;
        });

      expect(shown(real.events)).toStrictEqual(shown(pure.events));

      const at = `${real.events[differs]?.label} (step ${real.events[differs]?.step})`;

      expect({ at, plan: realPlans[differs] ?? null }).toStrictEqual({
        at,
        plan: purePlans[differs] ?? null,
      });
    },
    10 * MINUTE,
  );
});
