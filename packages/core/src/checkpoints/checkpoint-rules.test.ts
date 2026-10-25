import { type PlanItemKind } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import {
  type CheckpointItemCandidate,
  getBossSkillIds,
  getMissedSkills,
  getPassMark,
  hasPassedCheckpoint,
  planChallengeWrites,
  selectCheckpointItems,
} from "./checkpoint-rules";

describe(getPassMark, () => {
  it("needs seven of ten, scaled to the questions asked", () => {
    expect(getPassMark(10)).toBe(7);
    expect(getPassMark(8)).toBe(6);
    expect(hasPassedCheckpoint({ correct: 7, passMark: 7 })).toBe(true);
    expect(hasPassedCheckpoint({ correct: 6, passMark: 7 })).toBe(false);
  });
});

function candidate(
  id: string,
  skillId: string,
  { seen = false, trap = false }: { seen?: boolean; trap?: boolean } = {},
): CheckpointItemCandidate {
  return { hasMisconceptions: trap, id, seen, skillId };
}

describe(selectCheckpointItems, () => {
  it("mixes the phase's skills in turn and favors unseen traps within each", () => {
    const candidates = [
      candidate("a-plain", "a"),
      candidate("a-trap-seen", "a", { seen: true, trap: true }),
      candidate("a-trap", "a", { trap: true }),
      candidate("b-plain", "b"),
      candidate("b-seen", "b", { seen: true }),
    ];

    expect(selectCheckpointItems({ candidates, skillIds: ["a", "b"] })).toStrictEqual([
      "a-trap",
      "b-plain",
      "a-trap-seen",
      "b-seen",
      "a-plain",
    ]);
  });

  it("asks ten questions at most", () => {
    const candidates = Array.from({ length: 12 }, (_, index) => candidate(`c${index}`, "c"));

    expect(selectCheckpointItems({ candidates, skillIds: ["c"] })).toHaveLength(10);
  });
});

describe(getMissedSkills, () => {
  it("lists the skills a lost duel missed, the most missed first", () => {
    expect(
      getMissedSkills([
        { isCorrect: false, skillId: "a" },
        { isCorrect: false, skillId: "b" },
        { isCorrect: true, skillId: "c" },
        { isCorrect: false, skillId: "b" },
        { isCorrect: false, skillId: null },
      ]),
    ).toStrictEqual(["b", "a"]);
  });
});

/** A day in October 2026. */
function day(offset: number): Date {
  return new Date(Date.UTC(2026, 9, 1 + offset));
}

/** A plan item; undated ones come in plan order. */
function planItem({
  id,
  kind = "lesson",
  phase,
  position,
  scheduledFor = null,
  skillId = null,
}: {
  id: string;
  kind?: PlanItemKind;
  phase: number;
  position: number;
  scheduledFor?: Date | null;
  skillId?: string | null;
}) {
  return { chapterId: null, id, kind, lessonId: null, phase, position, scheduledFor, skillId };
}

describe(getBossSkillIds, () => {
  const skills = [
    { id: "atoms", phase: 0 },
    { id: "light", phase: 0 },
    { id: "spin", phase: 2 },
  ];

  const graphSkills = [
    { lessons: 2, skillId: "atoms" },
    { lessons: 1, skillId: "light" },
    { lessons: 1, skillId: "spin" },
  ];

  const items = [
    planItem({ id: "lesson-atoms", phase: 0, position: 0, skillId: "atoms" }),
    planItem({ id: "lesson-light", phase: 0, position: 1, skillId: "light" }),
    planItem({ id: "boss-0", kind: "boss", phase: 0, position: 2 }),
    planItem({ id: "lesson-atoms-2", phase: 1, position: 3, skillId: "atoms" }),
    planItem({ id: "boss-1", kind: "boss", phase: 1, position: 4 }),
    planItem({ id: "lesson-spin", phase: 2, position: 5, skillId: "spin" }),
    planItem({ id: "boss-2", kind: "boss", phase: 2, position: 6 }),
    planItem({ id: "boss-3", kind: "boss", phase: 3, position: 7 }),
  ];

  const itemSkillIds = new Map(items.map((item) => [item.id, item.skillId ? [item.skillId] : []]));

  const askedBy = (id: string) =>
    getBossSkillIds({
      boss: items.find((item) => item.id === id) ?? planItem({ id, phase: 0, position: 0 }),
      graphSkills,
      itemSkillIds,
      items,
      skills,
    });

  it("asks the skills its phase finished", () => {
    expect(askedBy("boss-0")).toStrictEqual(["atoms", "light"]);
    expect(askedBy("boss-2")).toStrictEqual(["spin"]);
  });

  // A skill belongs to the phase of its first lesson, so a phase whose lessons go on with earlier
  // skills had none of its own, and its challenge could never be asked.
  it("asks what a phase's lessons study when it finished no skill of its own", () => {
    expect(askedBy("boss-1")).toStrictEqual(["atoms"]);
  });

  // An exam window of practice and mocks only, such as Ana's practice phase before her lessons
  // reached it: its days practice everything studied so far.
  it("asks everything studied up to a phase that has no lessons", () => {
    expect(askedBy("boss-3")).toStrictEqual(["atoms", "light", "spin"]);
  });
});

describe("an exam window's challenge", () => {
  // Time-boxed windows: geometry begins late in the first, and the second of its core lessons (a
  // third of six) comes in the next one, after the first window's challenge (R40).
  const examWindows = [
    planItem({ id: "a1", phase: 0, position: 0, scheduledFor: day(1), skillId: "algebra" }),
    planItem({ id: "g1", phase: 0, position: 1, scheduledFor: day(3), skillId: "geometry" }),
    planItem({ id: "w0", kind: "boss", phase: 0, position: 2, scheduledFor: day(5) }),
    planItem({ id: "g2", phase: 1, position: 3, scheduledFor: day(7), skillId: "geometry" }),
    planItem({ id: "a2", phase: 1, position: 4, scheduledFor: day(8), skillId: "algebra" }),
    planItem({ id: "t1", phase: 1, position: 5, scheduledFor: day(9), skillId: "trig" }),
    planItem({ id: "w1", kind: "boss", phase: 1, position: 6, scheduledFor: day(10) }),
    planItem({ id: "s1", phase: 2, position: 7, scheduledFor: day(11), skillId: "stats" }),
    planItem({ id: "w2", kind: "boss", phase: 2, position: 8, scheduledFor: day(12) }),
  ];

  const skills = [
    { id: "algebra", phase: 0 },
    { id: "geometry", phase: 0 },
    { id: "trig", phase: 1 },
    { id: "stats", phase: 2 },
  ];

  const graphSkills = [
    { lessons: 3, skillId: "algebra" },
    { lessons: 6, skillId: "geometry" },
    { lessons: 3, skillId: "trig" },
    { lessons: 3, skillId: "stats" },
  ];

  const itemSkillIds = new Map(
    examWindows.map((item) => [item.id, item.skillId ? [item.skillId] : []]),
  );

  function askedBy(
    id: string,
    options: { graphSkills?: typeof graphSkills; items?: typeof examWindows } = {},
  ) {
    const items = options.items ?? examWindows;

    return getBossSkillIds({
      boss: items.find((item) => item.id === id) ?? planItem({ id, phase: 0, position: 0 }),
      graphSkills: options.graphSkills ?? graphSkills,
      itemSkillIds,
      items,
      skills,
    });
  }

  it("leaves out a skill whose core lessons come after its day", () => {
    expect(askedBy("w0")).toStrictEqual(["algebra"]);
  });

  // Asked by no challenge, a skill finished just after its window's challenge was never checked;
  // algebra's second lesson is the next window's teaching, which its own challenge tests.
  it("asks the next window's challenge a skill finished after the last one, and what it teaches", () => {
    expect(askedBy("w1")).toStrictEqual(["algebra", "geometry", "trig"]);
    expect(askedBy("w2")).toStrictEqual(["stats"]);
  });

  // The plan's days, which the plan's checks read too: a lesson done ahead keeps its day.
  it("goes by the plan's days, not the lessons done ahead of them", () => {
    const ahead = examWindows.map((item) =>
      item.id === "g2" ? { ...item, completedAt: day(4), status: "done" as const } : item,
    );

    expect(askedBy("w0", { items: ahead })).toStrictEqual(["algebra"]);
    expect(askedBy("w1", { items: ahead })).toStrictEqual(["algebra", "geometry", "trig"]);
  });

  it.each(["skipped", "testedOut"] as const)(
    "does not ask an earlier phase's skill again for a %s lesson",
    (status) => {
      const items = examWindows.map((item) => (item.id === "a2" ? { ...item, status } : item));

      expect(askedBy("w0", { items })).toStrictEqual(["algebra"]);
      expect(askedBy("w1", { items })).toStrictEqual(["geometry", "trig"]);
    },
  );

  // Class test seed 3: the phase's only skill of its own begins on its challenge's day, two of its
  // three core lessons after it, so the phase finished nothing new.
  it("asks what's finished, never a late skill, when the phase finished nothing new", () => {
    const items = [
      planItem({ id: "a1", phase: 0, position: 0, scheduledFor: day(1), skillId: "algebra" }),
      planItem({ id: "w0", kind: "boss", phase: 0, position: 1, scheduledFor: day(2) }),
      planItem({ id: "b1", phase: 1, position: 2, scheduledFor: day(3), skillId: "biology" }),
      planItem({ id: "w1", kind: "boss", phase: 1, position: 3, scheduledFor: day(3) }),
      planItem({ id: "b2", phase: 1, position: 4, scheduledFor: day(5), skillId: "biology" }),
    ];

    expect(
      getBossSkillIds({
        boss: items[3] ?? planItem({ id: "w1", phase: 1, position: 3 }),
        graphSkills: [
          { lessons: 3, skillId: "algebra" },
          { lessons: 6, skillId: "biology" },
        ],
        itemSkillIds: new Map(items.map((item) => [item.id, item.skillId ? [item.skillId] : []])),
        items,
        skills: [{ id: "algebra" }, { id: "biology" }],
      }),
    ).toStrictEqual(["algebra"]);
  });

  it("asks what its phase studied when no skill has its core in by its day yet", () => {
    const longer = graphSkills.map((skill) =>
      skill.skillId === "algebra" ? { ...skill, lessons: 6 } : skill,
    );

    expect(askedBy("w0", { graphSkills: longer })).toStrictEqual(["algebra", "geometry"]);
  });
});

describe("a challenge before an exam's continuation", () => {
  const items = [
    planItem({ id: "a1", phase: 0, position: 0, scheduledFor: day(1), skillId: "a" }),
    planItem({ id: "b1", phase: 0, position: 1, scheduledFor: day(2), skillId: "b" }),
    planItem({ id: "c1", phase: 0, position: 2, scheduledFor: day(3), skillId: "c" }),
    planItem({ id: "w0", kind: "boss", phase: 0, position: 3, scheduledFor: day(5) }),
    planItem({ id: "c2", phase: 1, position: 4, scheduledFor: day(7), skillId: "c" }),
    planItem({ id: "w1", kind: "boss", phase: 1, position: 5, scheduledFor: day(10) }),
    planItem({ id: "a2", phase: 2, position: 6, scheduledFor: day(15), skillId: "a" }),
    planItem({ id: "w2", kind: "boss", phase: 3, position: 7, scheduledFor: day(16) }),
  ];

  const plan = {
    goal: { kind: "exam" as const, targetDate: day(12) },
    graphSkills: [
      { lessons: 6, skillId: "a" },
      { lessons: 3, skillId: "b" },
      { lessons: 6, skillId: "c" },
    ],
    itemSkillIds: new Map(items.map((item) => [item.id, item.skillId ? [item.skillId] : []])),
    items,
    settings: { fullCourse: true },
    skills: ["a", "b", "c"].map((id) => ({ id })),
  };

  const boss = items[3]!;

  it("ignores after-exam core items but keeps core items between the challenge and exam", () => {
    expect(getBossSkillIds({ ...plan, boss })).toStrictEqual(["a", "b"]);

    expect(
      getBossSkillIds({ ...plan, boss, items: items.filter((item) => item.id !== "a2") }),
    ).toStrictEqual(["a", "b"]);
  });

  it("counts a required lesson on the exam day", () => {
    const onExam = items.map((item) =>
      item.id === "a2" ? { ...item, scheduledFor: day(12) } : item,
    );

    expect(getBossSkillIds({ ...plan, boss, items: onExam })).toStrictEqual(["b"]);

    expect(getBossSkillIds({ ...plan, boss: { ...boss, scheduledFor: day(12) } })).toStrictEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it.each([
    { goal: plan.goal, settings: { fullCourse: false } },
    { goal: { kind: "learn" as const, targetDate: day(12) }, settings: plan.settings },
    { goal: { kind: "exam" as const, targetDate: null }, settings: plan.settings },
  ])("keeps the ordinary core rule for $goal.kind with $settings", (context) => {
    expect(getBossSkillIds({ ...plan, ...context, boss })).toStrictEqual(["b"]);
  });

  it("keeps undated required items and an undated challenge's ordinary core", () => {
    const undated = items.map((item) =>
      item.id === "a2" ? { ...item, scheduledFor: null } : item,
    );

    expect(getBossSkillIds({ ...plan, boss, items: undated })).toStrictEqual(["b"]);

    expect(getBossSkillIds({ ...plan, boss: { ...boss, scheduledFor: null } })).toStrictEqual([
      "b",
    ]);
  });

  it("uses earlier challenges' pre-exam skills when an after-exam challenge selects unasked skills", () => {
    expect(getBossSkillIds({ ...plan, boss: items[7]! })).toStrictEqual(["a", "b", "c"]);
  });
});

describe(planChallengeWrites, () => {
  it("writes nothing for a challenge that already has its ten questions", () => {
    expect(
      planChallengeWrites([
        { questions: 6, skillId: "a" },
        { questions: 4, skillId: "b" },
      ]),
    ).toStrictEqual([]);
  });

  it("writes exactly what's missing, on the skills with fewest questions first", () => {
    expect(
      planChallengeWrites([
        { questions: 3, skillId: "a" },
        { questions: 0, skillId: "b" },
        { questions: 1, skillId: "c" },
      ]),
    ).toStrictEqual([
      { questionsPerSkill: 1, skillIds: ["a"], target: 4 },
      { questionsPerSkill: 3, skillIds: ["b"], target: 3 },
      { questionsPerSkill: 2, skillIds: ["c"], target: 3 },
    ]);
  });

  it("writes one question on each of the first skills when the phase has more skills than missing questions", () => {
    const counts = Array.from({ length: 14 }, (_, index) => ({
      questions: index < 2 ? 1 : 0,
      skillId: `s${index}`,
    }));

    expect(planChallengeWrites(counts)).toStrictEqual([
      {
        questionsPerSkill: 1,
        skillIds: ["s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"],
        target: 1,
      },
    ]);
  });

  it("puts all ten on a phase's only skill", () => {
    expect(planChallengeWrites([{ questions: 0, skillId: "a" }])).toStrictEqual([
      { questionsPerSkill: 10, skillIds: ["a"], target: 10 },
    ]);
  });
});
