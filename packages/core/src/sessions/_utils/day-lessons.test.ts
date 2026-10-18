import { describe, expect, it } from "vitest";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { getLessonLookahead, pickDayLessons } from "./day-lessons";

const TODAY = new Date("2026-10-06T00:00:00Z");
const TOMORROW = new Date("2026-10-07T00:00:00Z");

const graph = {
  phases: [],
  skills: [
    { area: "Língua Portuguesa", lessons: 4, name: "Ler", phase: 0, skillId: "reading", weight: 5 },
    {
      area: "Direito Constitucional",
      lessons: 4,
      name: "Princípios",
      phase: 0,
      skillId: "principles",
      weight: 4,
    },
    { area: "Língua Inglesa", lessons: 4, name: "Read", phase: 0, skillId: "english", weight: 3 },
  ],
};

type Item = ReturnType<typeof item>;

function item(id: string, skillId: string, scheduledFor: Date | null) {
  return {
    chapterId: null,
    id,
    kind: "lesson" as const,
    lessonId: `lesson-${id}` as string | null,
    scheduledFor,
    skillId,
    status: "todo" as const,
  };
}

const items = [
  item("pt-1", "reading", TODAY),
  item("cf-1", "principles", TODAY),
  item("en-1", "english", TOMORROW),
  item("pt-2", "reading", TOMORROW),
  item("cf-2", "principles", TOMORROW),
];

/** A day's lessons and held skills from its goal's plan. */
function pickDay({
  awaitingOutlines = false,
  graph: dayGraph = graph,
  idleSkillIds,
  isExam,
  items: dayItems,
  prerequisites,
  today,
}: {
  awaitingOutlines?: boolean;
  graph?: PlanGraph;
  idleSkillIds?: ReadonlySet<string>;
  isExam: boolean;
  items: readonly Item[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  today: Date;
}) {
  return pickDayLessons({
    awaitingOutlines,
    goal: { kind: isExam ? "exam" : "learn" },
    localDate: today,
    plan: { graph: dayGraph, idleSkillIds, items: dayItems, prerequisites },
  });
}

/** The day's pick when nothing due today is being outlined. */
function pick(input: { isExam: boolean; items: readonly Item[]; today: Date }) {
  return pickDay(input).learnItems;
}

describe(pickDayLessons, () => {
  it("keeps a held day's positive long-lesson portion and refuses future refills", () => {
    const long = {
      ...item("long", "reading", TOMORROW),
      facts: {
        days: [
          ["2026-10-06", 5, 5],
          ["2026-10-07", 55, 55],
        ],
        minutes: 60,
        parts: { checkpoint: 0, practice: 0, unwritten: 0, written: 60 },
        schemaVersion: 1,
        skillIds: ["reading"],
        teachingEnd: "2026-10-07",
      },
    };

    const picked = pickDayLessons({
      awaitingOutlines: false,
      goal: { kind: "learn" },
      heldDay: true,
      localDate: TODAY,
      plan: { graph, items: [item("pt-1", "reading", TODAY), long, ...items.slice(1)] },
    });

    expect(picked.learnItems.map((entry) => entry.id)).toStrictEqual(["pt-1", "long", "cf-1"]);
  });

  it("fills an exam day with today's lessons, then more of today's subjects, not tomorrow's", () => {
    const picked = pick({ isExam: true, items, today: TODAY });

    expect(picked.map((entry) => entry.id)).toStrictEqual(["pt-1", "cf-1", "pt-2", "cf-2"]);
  });

  it("keeps the time of today's lessons being outlined instead of reaching past them", () => {
    const waiting = [
      item("pt-1", "reading", TODAY),
      { ...item("cf-1", "principles", TODAY), lessonId: null },
      ...items.slice(2),
    ];

    expect(
      [true, false].map((isExam) =>
        pickDay({ awaitingOutlines: true, isExam, items: waiting, today: TODAY }).learnItems.map(
          (entry) => entry.id,
        ),
      ),
    ).toStrictEqual([["pt-1"], ["pt-1"]]);
  });

  it("reaches past stand-ins nobody is outlining, which have nothing to open", () => {
    const waiting = [{ ...item("en-0", "english", TODAY), lessonId: null }, ...items];

    expect(pick({ isExam: false, items: waiting, today: TODAY })).toStrictEqual(items);
  });

  it("never reaches a lesson whose skill builds on a stand-in it passes", () => {
    // A language plan reached past every stand-in to a lesson a year away, before the one it
    // builds on was outlined.
    const waiting = [{ ...item("en-0", "english", TODAY), lessonId: null }, ...items];

    const picked = pickDay({
      isExam: false,
      items: waiting,
      prerequisites: new Map([["principles", ["english"]]]),
      today: TODAY,
    }).learnItems;

    // The first principles lesson waits for English; the second comes after English's lesson.
    expect(picked.map((entry) => entry.id)).toStrictEqual(["pt-1", "en-1", "pt-2", "cf-2"]);
  });

  it("follows the plan's order for other goals and on a day with nothing due", () => {
    expect(pick({ isExam: false, items, today: TODAY })).toStrictEqual(items);

    const later = items.filter((entry) => entry.scheduledFor === TOMORROW);

    expect(pick({ isExam: true, items: later, today: TODAY })).toStrictEqual(later);
  });
});

/** Rafaela's Câmara day one: linguistics written, IT's lessons not written yet. */
const camara = {
  phases: [],
  skills: [
    { area: "Linguística", lessons: 9, name: "Ler", phase: 0, skillId: "ling", weight: 5 },
    { area: "TI", lessons: 9, name: "Redes", phase: 0, skillId: "ti", weight: 4 },
    { area: "Ciência Política", lessons: 9, name: "Estado", phase: 0, skillId: "cp", weight: 4 },
  ],
};

function camaraPick(day: readonly Item[]) {
  return pickDay({ graph: camara, isExam: true, items: day, today: TODAY }).learnItems.map(
    (entry) => entry.id,
  );
}

function standIn(id: string, skillId: string, scheduledFor: Date) {
  return { ...item(id, skillId, scheduledFor), lessonId: null };
}

describe("an exam day whose subjects aren't all written yet", () => {
  // Her day one was 27 linguistics lessons: IT's had nothing to open, and the day filled with
  // more of the subject it had.
  it("keeps a subject with nothing written its own time, never another subject's", () => {
    const day = [
      standIn("ti-1", "ti", TODAY),
      item("li-1", "ling", TODAY),
      item("li-2", "ling", TODAY),
      ...["li-3", "li-4", "li-5"].map((id) => item(id, "ling", TOMORROW)),
      item("cp-1", "cp", TOMORROW),
    ];

    expect(camaraPick(day)).toStrictEqual(["li-1", "li-2"]);

    expect(
      pickDay({ graph: camara, isExam: true, items: day, today: TODAY }).heldSkillIds,
    ).toStrictEqual(new Set(["ti"]));
  });

  // An exam's listening skills are practiced only with recordings: while none is voiced, the
  // listening subject's time would go to practice that asks nothing.
  it("gives a held subject's time to the others when practice has nothing to ask it", () => {
    const day = [
      standIn("ti-1", "ti", TODAY),
      item("li-1", "ling", TODAY),
      item("li-2", "ling", TODAY),
      ...["li-3", "li-4", "li-5"].map((id) => item(id, "ling", TOMORROW)),
      item("cp-1", "cp", TOMORROW),
    ];

    const { heldSkillIds, learnItems } = pickDay({
      graph: camara,
      idleSkillIds: new Set(["ti"]),
      isExam: true,
      items: day,
      today: TODAY,
    });

    expect(learnItems.map((entry) => entry.id)).toStrictEqual([
      "li-1",
      "li-2",
      "li-3",
      "li-4",
      "li-5",
    ]);

    expect(heldSkillIds).toStrictEqual(new Set());
  });

  it("takes a subject's own next written lessons for the ones it has nothing written for yet", () => {
    const day = [
      item("li-1", "ling", TODAY),
      standIn("li-x", "ling", TODAY),
      item("ti-1", "ti", TODAY),
      ...["li-2", "li-3"].map((id) => item(id, "ling", TOMORROW)),
      item("ti-2", "ti", TOMORROW),
    ];

    expect(camaraPick(day).slice(0, 3)).toStrictEqual(["li-1", "ti-1", "li-2"]);
  });
});

describe(getLessonLookahead, () => {
  it("looks ahead at a lesson for every few minutes of the day, and at least eight", () => {
    expect([15, 30, 120, 240].map((minutes) => getLessonLookahead(minutes))).toStrictEqual([
      8, 8, 30, 60,
    ]);
  });
});
