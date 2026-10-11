import { describe, expect, it } from "vitest";
import { runSimLife } from "./_test-utils/sim/sim-life";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";

const MINUTE = 60_000;

async function findR11(life: SimLife) {
  const { violations } = await runSimLife(life);
  return violations.filter((violation) => violation.rule === "R11");
}

describe("a plan short on time cuts the least asked topics first", () => {
  // Câmara at 15 minutes a day after placement and missed days: the Portuguese topic on word
  // meaning, which the learner missed, left while a topic asked as often kept lessons.
  it(
    "keeps a most asked exam topic after a time cut",
    async () => {
      const violations = await findR11({
        dailyMinutes: 180,
        fixture: "camara",
        knownAreas: [],
        pending: [],
        seed: 1003,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [39, false],
              [96, true],
              [12, true],
              [30, true],
              [100, false],
              [77, false],
              [57, false],
              [67, true],
              [50, false],
              [17, false],
              [105, true],
            ],
            kind: "placement",
          },
          { days: 3, kind: "miss" },
          { kind: "change", spec: { kind: "time", minutes: 15 }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 72,
      });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // ENEM at 60 minutes, a rest day added on day three: organic chemistry left natural sciences
  // while three topics asked less kept lessons.
  it(
    "keeps a most asked exam topic after a rest day change",
    async () => {
      const violations = await findR11({
        dailyMinutes: 60,
        fixture: "enem",
        knownAreas: [],
        pending: [],
        seed: 1001,
        speed: 1,
        start: "2026-10-12",
        steps: [
          { finish: 0.25, kind: "study", misses: [] },
          { finish: 0.75, kind: "study", misses: [1] },
          { kind: "change", spec: { kind: "restDay", weekday: 3 }, via: "editor" },
        ],
        subscribed: false,
        targetInDays: 53,
      });

      expect(violations).toStrictEqual([]);
    },
    5 * MINUTE,
  );

  // Five missed days before the class test: the catch-up left out the cell
  // membrane, taught by the osmosis skill whose essay the teacher announced, while unannounced
  // topics kept lessons. Osmosis has no lesson written yet, so only its skill says it's announced.
  // The same catch-up deleted the nucleus, a lesson an earlier day left, which gave way to the
  // announced topics: work earlier days left stays in the plan, set aside and named (R8).
  it(
    "keeps an announced class test topic after missed days, setting aside the work it gives way to",
    async () => {
      const { violations } = await runSimLife({
        dailyMinutes: 15,
        fixture: "class-test",
        knownAreas: [],
        pending: [3, 5],
        proposals: "decline",
        seed: 6,
        speed: 1.2,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [4, false],
              [6, false],
              [1, false],
            ],
            kind: "placement",
          },
          { days: 2, kind: "miss" },
          { days: 3, kind: "miss" },
          { kind: "refresh" },
        ],
        subscribed: true,
        targetInDays: 12,
      });

      expect(
        violations.filter((violation) => ["R8", "R11"].includes(violation.rule)),
      ).toStrictEqual([]);
    },
    MINUTE,
  );

  // Three missed days a week before the class test: the settle set aside the cell
  // membrane's lessons while unannounced cell theory and viruses kept theirs. The teacher announced
  // an essay on osmosis, whose skill the learner answered right once, so the membrane skill was the
  // way into a topic the test asks for certain.
  it(
    "keeps the way into an announced topic when its announced skill is known",
    async () => {
      const violations = await findR11({
        dailyMinutes: 15,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1076,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [1, false],
              [4, true],
              [5, true],
              [0, false],
              [3, true],
              [1, true],
            ],
            kind: "placement",
          },
          { finish: 0.25, kind: "study", misses: [] },
          { days: 3, kind: "miss" },
          { finish: 1, kind: "study", misses: [3] },
        ],
        subscribed: false,
        targetInDays: 8,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // Câmara at 60 minutes a day, every placement answer wrong: placement skipped
  // nothing, so nothing planned again, and the Linguistics topics it had just found missing stayed
  // out while three skills nobody asked about kept 26 lessons. Placement plans again whenever its
  // answers change what the plan ranks by (the lead, 10 Oct).
  it(
    "brings in what placement found missing when it skips nothing",
    async () => {
      const violations = await findR11({
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [],
        pending: [],
        seed: 1121,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [65, false],
              [106, false],
              [32, false],
              [90, false],
            ],
            kind: "placement",
          },
        ],
        subscribed: false,
        targetInDays: 58,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // Four missed days two weeks before the class test, with the prokaryotes base as a quick lesson:
  // the catch-up kept cell theory, which nobody asked about, and left out the nucleus, which
  // placement had just found missing. The plan with the base's whole core set cell theory aside,
  // but the plan following its order carried it in first all the same.
  it(
    "sets aside the same earlier days' work when a base is studied another way",
    async () => {
      const violations = await findR11({
        dailyMinutes: 20,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1125,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [1, true],
              [3, false],
              [5, false],
              [4, false],
              [3, true],
              [6, false],
              [1, false],
              [3, false],
            ],
            kind: "placement",
          },
          { days: 3, kind: "miss" },
          { days: 1, kind: "miss" },
          { finish: 0.75, kind: "study", misses: [5] },
        ],
        subscribed: false,
        targetInDays: 14,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A class test at 15 minutes after a focus and two sessions: the nucleus, which placement missed
  // once, left while an equally asked topic the learner didn't miss kept a lesson. The same learner
  // then asks the buddy for balanced practice: the nucleus, answered right, wrong and right in
  // placement, left again. A miss anywhere counts as missed, whatever came after it.
  it(
    "keeps a missed class test topic before an equally asked one, whatever came after the miss",
    async () => {
      const violations = await findR11({
        dailyMinutes: 15,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1004,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [2, true],
              [6, false],
              [5, true],
              [3, true],
              [5, false],
              [3, true],
              [5, true],
              [4, false],
            ],
            kind: "placement",
          },
          { kind: "change", spec: { area: 0, kind: "focus" }, via: "editor" },
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { bias: "balanced", kind: "practice" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 10,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A class test 5 days away at 15 minutes a day: the announced
  // organelles were out of the new plan while osmosis and the membrane kept 5 lessons. Osmosis has
  // no lesson written yet, so only its skill could say the teacher announced its essay.
  it(
    "keeps an announced class test topic whose skill has no lesson written yet",
    async () => {
      const violations = await findR11({
        dailyMinutes: 15,
        fixture: "class-test",
        knownAreas: [],
        pending: [4],
        seed: 1013,
        speed: 1,
        start: "2026-10-12",
        steps: [],
        subscribed: false,
        targetInDays: 5,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // ENEM at 180 minutes a day: when outlines landed, pH, which the learner
  // missed, left while fluids, asked as often and not missed, kept its core. pH builds on aqueous
  // solutions, which the plan held only in part, so its way in cost more than the time left at its
  // turn, and the topic next in rank that fit took that time.
  it(
    "lets a missed topic go only when its way in doesn't fit",
    async () => {
      const violations = await findR11({
        dailyMinutes: 180,
        fixture: "enem",
        knownAreas: [],
        pending: [
          10, 13, 42, 48, 50, 57, 67, 68, 73, 74, 79, 81, 86, 87, 90, 99, 105, 109, 110, 113, 127,
          128, 132,
        ],
        proposals: "apply",
        seed: 1,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [127, false],
              [121, true],
              [8, false],
              [2, true],
              [85, true],
              [99, true],
              [52, false],
            ],
            kind: "placement",
          },
          { finish: 1, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 34,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // ENEM at 60 minutes a day (sim run21, seed 2000): placement missed a skill on molecules, cells
  // and tissues, so that topic ranks as missed, yet when outlines landed the cheapest way into it
  // ranked as unmissed and left, while ecology and living-group topics asked as often kept 12
  // lessons. A topic is missed when any skill teaching it was.
  it(
    "keeps a missed topic in by its cheapest way when another skill teaching it was the one missed",
    async () => {
      const violations = await findR11({
        dailyMinutes: 60,
        fixture: "enem",
        knownAreas: [4],
        pending: [
          7, 9, 17, 24, 29, 35, 46, 49, 50, 52, 55, 63, 66, 83, 88, 91, 93, 97, 98, 104, 114, 117,
          119, 125, 133,
        ],
        proposals: "apply",
        seed: 2000,
        speed: 0.8,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [79, false],
              [24, false],
              [61, true],
              [117, false],
              [74, true],
              [4, true],
              [133, true],
              [89, true],
              [81, true],
              [42, false],
              [54, false],
              [66, false],
            ],
            kind: "placement",
          },
          { finish: 0, kind: "study", misses: [133] },
        ],
        subscribed: false,
        targetInDays: 38,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // Câmara at 60 minutes a day: at the first session's end, legislative
  // drafting, which placement missed, left while official correspondence, which nobody missed,
  // kept 11 lessons. Both build on the missed text-genres skill, and bundled with it, official
  // correspondence ranked as missed and cheaper per topic. Before it, the buddy's "less Língua
  // Portuguesa" left a day where the study cycle's own subjects waited, and the lesson it gave that
  // day was a skill whose base, in another subject, hadn't started (R16).
  it(
    "keeps a missed topic before one that only shares its missed base",
    async () => {
      const { violations } = await runSimLife({
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [1],
        mockOffers: "focus",
        pending: [7, 16, 20, 22, 26, 33, 37, 50, 53, 63, 64, 66, 85, 86, 87, 91, 108, 113, 116],
        proposals: "apply",
        seed: 2005,
        speed: 1.5,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [70, false],
              [73, true],
              [41, true],
              [107, false],
              [54, false],
              [16, true],
              [26, false],
              [32, false],
              [89, false],
              [113, true],
              [104, true],
              [70, true],
            ],
            kind: "placement",
          },
          { kind: "change", spec: { area: 2, kind: "reduce" }, via: "buddy" },
          { finish: 1, kind: "study", misses: [116] },
          { count: 3, kind: "land" },
        ],
        subscribed: false,
        targetInDays: 57,
      });

      expect(
        violations.filter((violation) => ["R11", "R16"].includes(violation.rule)),
      ).toStrictEqual([]);
    },
    MINUTE,
  );

  // Câmara at 240 minutes a day, a subject the learner knows taking its bases as quick lessons:
  // when the first session ended, the preliminary technical study, asked often, left while the
  // administrative process, asked least, kept 7 lessons. The plan followed the order of the one
  // with every base's core, laid out from today, but a session's end leaves this week as it was
  // shown: with less time, it cut that order's last lessons instead of the least asked.
  it(
    "keeps a topic asked more when a session ends on a plan with bases studied another way",
    async () => {
      const violations = await findR11({
        dailyMinutes: 240,
        fixture: "camara",
        knownAreas: [10],
        mockOffers: "focus",
        pending: [5, 6, 15, 25, 26, 38, 43, 45, 57, 67, 70, 91, 96, 108],
        seed: 2008,
        speed: 1.5,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [50, true],
              [97, false],
              [59, false],
              [75, true],
              [24, true],
              [47, true],
              [78, false],
              [27, true],
              [98, false],
              [106, true],
              [58, true],
            ],
            kind: "placement",
          },
          { finish: 1, kind: "study", misses: [49] },
        ],
        subscribed: false,
        targetInDays: 59,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // Câmara at 60 minutes a day, placement on day one: data visualization, which placement missed,
  // stayed out while networks and digital security, asked as often and not missed, kept 18 lessons.
  // With its base, its way in came 2 minutes over the time its subject had left, and the two topics
  // nobody missed, which fit, took that time whole.
  it(
    "keeps a missed topic in part before topics asked as often that nobody missed",
    async () => {
      const violations = await findR11({
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [8],
        mockOffers: "skip",
        pending: [0, 29, 42, 44, 45, 46, 53, 54, 57, 60, 64, 75, 83, 91, 92, 94, 103, 112],
        seed: 2050,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [44, true],
              [76, false],
              [10, true],
              [29, false],
              [88, true],
              [42, false],
              [99, true],
              [2, true],
              [50, true],
            ],
            kind: "placement",
          },
        ],
        subscribed: false,
        targetInDays: 45,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A class test four days away with its prokaryotes base as a quick lesson: after two missed days,
  // viruses, which placement missed, were set aside while the nucleus, which nobody missed, kept
  // its lesson. Following the plan with every base's core, the day's carried work went in unranked;
  // ranked, everything the missed days left fits the day.
  it(
    "ranks the work earlier days left when the plan studies a base another way",
    async () => {
      const violations = await findR11({
        dailyMinutes: 45,
        fixture: "class-test",
        knownAreas: [],
        pending: [],
        seed: 1186,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [3, true],
              [6, false],
              [0, true],
            ],
            kind: "placement",
          },
          { days: 2, kind: "miss" },
          { finish: 1, kind: "study", misses: [5] },
        ],
        subscribed: false,
        targetInDays: 4,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // Câmara at 240 minutes a day, a subject the learner knows taking eight bases as quick lessons:
  // on day one, the legislative procedures topic, asked more, was out while provisional measures,
  // asked less, kept 7 lessons. The plan followed the order of the one with every base's core, and
  // a base whose core became a quick lesson read as kept, so its quick lesson went after
  // everything and didn't fit.
  it(
    "keeps a base's own topic when a quick lesson takes its core's place",
    async () => {
      const violations = await findR11({
        dailyMinutes: 240,
        fixture: "camara",
        knownAreas: [1],
        pending: [2, 6, 18, 23, 36, 52, 57, 59, 61, 64, 69, 73, 76, 88, 113],
        seed: 2100,
        speed: 1.5,
        start: "2026-10-12",
        steps: [],
        subscribed: false,
        targetInDays: 60,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // A class test five days away at 20 minutes a day, after two missed days: on the last study day,
  // the cut ranked organelles, which placement missed, first through prokaryotes, its base. The two
  // didn't fit the 4 minutes left, and the base left with that way, so prokaryotes never competed
  // for its own topic, asked more than cell theory, which took the time.
  it(
    "lets a base compete for its own topic when the way through it doesn't fit",
    async () => {
      const violations = await findR11({
        dailyMinutes: 20,
        fixture: "class-test",
        knownAreas: [],
        pending: [4],
        seed: 1236,
        speed: 1,
        start: "2026-10-12",
        steps: [
          {
            answers: [
              [4, false],
              [3, false],
              [2, true],
              [6, true],
              [5, true],
              [0, true],
              [2, true],
              [0, true],
            ],
            kind: "placement",
          },
          { finish: 0, kind: "study", misses: [] },
          { days: 2, kind: "miss" },
          { finish: 1, kind: "study", misses: [] },
        ],
        subscribed: false,
        targetInDays: 5,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );

  // Câmara at 60 minutes a day, four study days in: the session's run kept fundamental rights,
  // the constitutional topic asked most, first in its subject's cut, but political science's least
  // asked topic builds on the Constitution's principles and federal organization, which the cut
  // left out. The study cycle brought those two forward for it, and they took the subject's time.
  it(
    "keeps a most asked topic before what another subject's less asked topic builds on",
    async () => {
      const violations = await findR11({
        dailyMinutes: 60,
        fixture: "camara",
        knownAreas: [],
        pending: [],
        seed: 1243,
        speed: 1.5,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { finish: 1, kind: "study", misses: [88] },
          { finish: 0.25, kind: "study", misses: [64] },
          { finish: 1, kind: "study", misses: [89] },
        ],
        subscribed: false,
        targetInDays: 64,
      });

      expect(violations).toStrictEqual([]);
    },
    MINUTE,
  );
});
