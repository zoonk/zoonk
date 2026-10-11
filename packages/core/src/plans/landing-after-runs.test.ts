import { describe, expect, it } from "vitest";
import { listNextDaySwaps } from "./_test-utils/next-day-swaps";
import { checkLandingMovesOnlyLanded } from "./_test-utils/rules/landing-rules";
import { getRuleItemKey } from "./_test-utils/rules/rule-items";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife, type SimLifeStep } from "./_test-utils/sim/sim-life-plan";
import { type SimResult } from "./_test-utils/sim/sim-runner";
import { type SimPlan } from "./_test-utils/sim/sim-world";
import { toIsoDate } from "./planner/plan-calendar";

const MINUTE = 60_000;

/**
 * What the run of a traced life's last landing moved outside the skills it outlined: each item of
 * another skill, and every challenge, mock and review, as `key|status|day`, before and after it,
 * and the ones it put in another phase.
 */
function readLandingMoves({ events, plans }: SimResult) {
  const index = events.findLastIndex((event) => event.label === "land");
  const before = plans[index - 1]?.items ?? [];
  const after = plans[index]?.items ?? [];
  const lessonIds = new Set(before.flatMap((item) => item.lessonId ?? []));

  const outlined = new Set(
    after.flatMap((item) =>
      item.lessonId && item.skillId && !lessonIds.has(item.lessonId) ? [item.skillId] : [],
    ),
  );

  const describeOthers = (items: SimPlan["items"]) =>
    items
      .filter((item) => !outlined.has(item.skillId ?? ""))
      .map(
        (item) =>
          `${getRuleItemKey(item)}|${item.status}|${item.scheduledFor ? toIsoDate(item.scheduledFor) : "-"}`,
      );

  const was = describeOthers(before);
  const now = describeOthers(after);
  const phases = new Map(before.map((item) => [getRuleItemKey(item), item.phase]));

  const isMovedToPhase = (item: SimPlan["items"][number]) => {
    const phase = phases.get(getRuleItemKey(item));
    return phase !== undefined && phase !== item.phase && !outlined.has(item.skillId ?? "");
  };

  return {
    added: now.filter((entry) => !was.includes(entry)),
    lost: was.filter((entry) => !now.includes(entry)),
    phases: after.filter((item) => isMovedToPhase(item)).map((item) => getRuleItemKey(item)),
  };
}

/** What each landing of the life moved that it didn't touch (R41), as the rule says it. */
async function findLandingHits(life: SimLife) {
  const { violations } = await runSimLife(life, { check: checkLandingMovesOnlyLanded });
  return violations.map((violation) => ({ details: violation.details, step: violation.step }));
}

async function findNextDaySwaps(life: SimLife) {
  return listNextDaySwaps(await runSimLife(life, { trace: true }));
}

// Outlines landing for one skill right after a learner's change that day swap its stand-in for its
// lessons and leave the rest of the plan as the change laid it out. Planned again without the
// change's steering, an OAB plan's first landing moved 589 items of other skills and swapped topics.
describe("a landing right after a learner's change", () => {
  it(
    "keeps the rest of an OAB plan a focus re-planned on day one",
    async () => {
      const result = await runSimLife(
        {
          dailyMinutes: 120,
          fixture: "oab",
          knownAreas: [15],
          pending: [0, 10, 15, 27, 34, 44, 55, 61, 64, 65, 66, 88, 93, 96, 97, 98],
          proposals: "apply",
          seed: 2003,
          speed: 0.8,
          start: "2026-10-12",
          steps: [
            {
              answers: [
                [42, false],
                [44, true],
                [46, true],
                [36, true],
                [64, true],
                [38, false],
                [98, false],
                [14, false],
              ],
              kind: "placement",
            },
            { kind: "change", spec: { area: 12, kind: "focus" }, via: "buddy" },
            { kind: "refresh" },
            { count: 1, kind: "land" },
          ],
          subscribed: true,
          targetInDays: 107,
        },
        { trace: true },
      );

      expect(readLandingMoves(result)).toStrictEqual({ added: [], lost: [], phases: [] });
    },
    MINUTE,
  );
});

// A learner's new date re-plans the phase ends with the cut a plan short on time makes, and the
// next run keeps those ends. Judged on the kept ends, which hold each challenge on its day whatever
// the day's time, the plan read as fitting, skipped the cut, gained lessons and moved a career
// plan's lessons into other phases on its first landing. The refresh before that landing keeps
// the plan the new date saved (R32).
describe("a landing right after a learner's new date", () => {
  it(
    "keeps every other lesson of a career plan short on time in its phase",
    async () => {
      const result = await runSimLife(
        {
          dailyMinutes: 15,
          fixture: "career",
          knownAreas: [],
          mockOffers: "focus",
          pending: [4, 10, 20],
          proposals: "apply",
          seed: 2021,
          speed: 1,
          start: "2026-10-12",
          steps: [
            {
              kind: "change",
              spec: { base: 2, choice: "essential", kind: "bases" },
              via: "editor",
            },
            { count: 1, kind: "land" },
            { days: 2, kind: "miss" },
            { days: 3, kind: "miss" },
            { kind: "change", spec: { days: 7, kind: "date" }, via: "editor" },
            { kind: "refresh" },
            { count: 1, kind: "land" },
          ],
          subscribed: false,
          targetInDays: 149,
        },
        { trace: true },
      );

      expect(readLandingMoves(result).phases).toStrictEqual([]);
      expect(result.violations.filter((violation) => violation.rule === "R32")).toStrictEqual([]);
    },
    MINUTE,
  );
});

// A session whose new pace no longer fits this week's work in it lays the rest out from the next
// day, as that day's first run would, so the next morning finds the plan it saved. Kept as it was,
// a Câmara plan whose pace slowed spilled three days into the next week, and the next morning's
// settling planned the week again: 29 lessons of 10 skills left the plan and 5 came in. An OAB
// plan's next morning took 8 lessons out when a stand-in's 15 lessons all landed on its day.
describe("an exam plan the morning after a session", () => {
  const oab: SimLife = {
    dailyMinutes: 120,
    fixture: "oab",
    knownAreas: [15],
    pending: [0, 10, 15, 27, 34, 44, 55, 61, 64, 65, 66, 88, 93, 96, 97, 98],
    proposals: "apply",
    seed: 2003,
    speed: 0.8,
    start: "2026-10-12",
    steps: [
      {
        answers: [
          [42, false],
          [44, true],
          [46, true],
          [36, true],
          [64, true],
          [38, false],
          [98, false],
          [14, false],
        ],
        kind: "placement",
      },
      { kind: "change", spec: { area: 12, kind: "focus" }, via: "buddy" },
      { kind: "refresh" },
    ],
    subscribed: true,
    targetInDays: 107,
  };

  const study: SimLifeStep = { finish: 1, kind: "study", misses: [] };

  it(
    "keeps every topic of a Câmara plan settled the morning after a quarter-studied day",
    async () => {
      const swaps = await findNextDaySwaps({
        dailyMinutes: 120,
        fixture: "camara",
        knownAreas: [7],
        mockOffers: "skip",
        pending: [0, 23, 26, 34, 38, 45, 60, 89, 97, 110],
        proposals: "decline",
        seed: 2001,
        speed: 1.5,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [116, false],
              [106, false],
              [29, false],
              [42, true],
              [13, false],
            ],
            kind: "placement",
          },
          { kind: "change", spec: { inDays: 7, kind: "lightWeek" }, via: "editor" },
          { kind: "change", spec: { area: 5, kind: "focus" }, via: "editor" },
          { kind: "change", spec: { kind: "restDay", weekday: 3 }, undo: true, via: "buddy" },
          { days: 2, kind: "miss" },
          study,
          { kind: "refresh" },
          { finish: 0.25, kind: "study", misses: [] },
          { count: 1, kind: "land" },
        ],
        subscribed: false,
        targetInDays: 112,
      });

      expect(swaps).toStrictEqual({ added: [], lost: [] });
    },
    MINUTE,
  );

  // Its refresh right after the day-one focus keeps the plan that focus saved (R32): planned again
  // in another mode, it moved 600 items with nothing new.
  it(
    "keeps an OAB plan as the session the day before left it",
    async () => {
      const result = await runSimLife(
        { ...oab, steps: [...oab.steps, study, { count: 1, kind: "land" }] },
        { trace: true },
      );

      expect(listNextDaySwaps(result)).toStrictEqual({ added: [], lost: [] });
      expect(result.violations.filter((violation) => violation.rule === "R32")).toStrictEqual([]);
    },
    MINUTE,
  );
});

// A stand-in is saved as one item on its first part's day, but its parts can run for months. Day
// one's landing put every lesson of an OAB plan's two stand-ins on this week, though most were
// December's, so the week spilled and the rest was laid out again from Monday: 736 items moved
// and topics swapped. Lessons that land take their stand-in's parts' days.
describe("a day-one landing in an exam plan", () => {
  it(
    "keeps the rest of an OAB plan whose stand-ins run into December",
    async () => {
      const hits = await findLandingHits({
        dailyMinutes: 170,
        fixture: "oab",
        knownAreas: [],
        pending: [2, 7, 14, 18, 19, 37, 42, 43, 44, 51, 52, 57, 60, 64, 71, 72, 76, 80, 89, 105],
        seed: 1161,
        speed: 1,
        start: "2026-10-12",
        steps: [{ finish: 0.25, kind: "study", misses: [60] }],
        subscribed: false,
        targetInDays: 147,
      });

      expect(hits).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps the rest of a Câmara plan a studied day landed lessons in",
    async () => {
      const hits = await findLandingHits({
        dailyMinutes: 240,
        fixture: "camara",
        knownAreas: [],
        pending: [5, 6, 9, 21, 23, 54, 63, 83, 88, 98, 105, 109],
        seed: 1160,
        speed: 1,
        start: "2026-10-12",
        steps: [{ finish: 1, kind: "study", misses: [82] }],
        subscribed: false,
        targetInDays: 95,
      });

      expect(hits).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps the rest of a Câmara plan right after placement",
    async () => {
      const hits = await findLandingHits({
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [],
        mockOffers: "skip",
        pending: [12, 13, 14, 21, 55, 63, 80, 81, 82, 85, 87, 103, 104, 115],
        seed: 2080,
        speed: 1.2,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [82, false],
              [109, false],
              [14, true],
              [30, false],
              [80, true],
              [44, true],
            ],
            kind: "placement",
          },
          { finish: 1, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 98,
      });

      expect(hits).toStrictEqual([]);
    },
    MINUTE,
  );

  it(
    "keeps the rest of an ENEM plan three quarters of a day landed lessons in",
    async () => {
      const hits = await findLandingHits({
        dailyMinutes: 60,
        fixture: "enem",
        knownAreas: [],
        pending: [5, 6, 9, 21, 23, 54, 63, 83, 88, 98, 105, 109, 122, 123, 129, 130],
        seed: 1160,
        speed: 1,
        start: "2026-10-12",
        steps: [{ finish: 0.75, kind: "study", misses: [] }],
        subscribed: false,
        targetInDays: 49,
      });

      expect(hits).toStrictEqual([]);
    },
    MINUTE,
  );

  // The refresh after placement landed a stand-in Friday began: its lessons all went on Friday,
  // which went from 21 lessons to 44, far past the learner's time.
  it(
    "keeps the rest of an ENEM plan whose Friday stand-in landed",
    async () => {
      const hits = await findLandingHits({
        dailyMinutes: 180,
        fixture: "enem",
        knownAreas: [2],
        mockOffers: "skip",
        pending: [12, 13, 14, 21, 55, 63, 80, 81, 82, 85, 87, 103, 104, 115, 118, 124, 129],
        seed: 2080,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [112, true],
              [110, false],
              [115, false],
              [68, true],
            ],
            kind: "placement",
          },
          { kind: "refresh" },
        ],
        subscribed: true,
        targetInDays: 50,
      });

      expect(hits).toStrictEqual([]);
    },
    MINUTE,
  );

  // A landed skill waited for the next lesson of a base the learner had begun (9 lessons done):
  // its lessons went a month past its stand-in's day.
  it(
    "keeps a Câmara skill's landed lessons on its stand-in's days when its base is begun",
    async () => {
      const hits = await findLandingHits({
        dailyMinutes: 240,
        fixture: "camara",
        knownAreas: [],
        pending: [8, 26, 36, 44, 50, 67, 68, 79, 85, 91, 93, 102, 103, 106, 109, 114],
        seed: 1263,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [33, true],
              [3, true],
              [4, true],
              [115, false],
            ],
            kind: "placement",
          },
          { finish: 0.75, kind: "study", misses: [] },
          { finish: 0.5, kind: "study", misses: [66] },
          { days: 3, kind: "miss" },
          { count: 2, kind: "land" },
          { count: 3, kind: "land" },
        ],
        subscribed: false,
        targetInDays: 57,
      });

      expect(hits).toStrictEqual([]);
    },
    MINUTE,
  );
});
