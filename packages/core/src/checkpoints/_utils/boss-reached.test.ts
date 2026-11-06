import { type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { type ChallengePlan, findSessionBosses, getBossTimings } from "./boss-reached";

function day(offset: number): Date {
  return new Date(Date.UTC(2026, 9, 1 + offset));
}

function item({
  id,
  kind = "lesson",
  on,
  phase,
  skillId = null,
  status = "todo",
}: {
  id: string;
  kind?: PlanItemKind;
  on: number;
  phase: number;
  skillId?: string | null;
  status?: PlanItemStatus;
}) {
  return {
    chapterId: null,
    id,
    kind,
    lessonId: null,
    phase,
    scheduledFor: day(on),
    skillId,
    status,
  };
}

type Item = ReturnType<typeof item> & { position: number };

function plan({
  exam = false,
  graphSkills,
  items,
  listeningSkillIds = new Set(),
  phaseEnds = [],
}: {
  exam?: boolean;
  graphSkills: { lessons?: number; phase: number; skillId: string }[];
  items: ReturnType<typeof item>[];
  listeningSkillIds?: ReadonlySet<string>;
  phaseEnds?: number[];
}): ChallengePlan<Item> {
  return {
    goal: exam ? { kind: "exam", targetDate: day(60) } : { kind: "learn", targetDate: null },
    graphSkills: graphSkills.map((skill) => ({ lessons: 1, ...skill })),
    itemSkillIds: new Map(items.map((entry) => [entry.id, entry.skillId ? [entry.skillId] : []])),
    items: items.map((entry, position) => ({ ...entry, position })),
    listeningSkillIds,
    phases: phaseEnds.map((end) => ({ endDate: day(end).toISOString().slice(0, 10) })),
    skills: graphSkills.map((skill) => ({ id: skill.skillId })),
  };
}

function offered(challengePlan: ChallengePlan<Item>, today: number): (string | null)[] {
  return findSessionBosses({ plan: challengePlan, today: day(today) }).map((boss) => boss.id);
}

describe("a due phase challenge", () => {
  const graphSkills = [
    { phase: 0, skillId: "a" },
    { phase: 1, skillId: "b" },
  ];

  it.each([
    { a: "todo", b: "todo", offers: [], timings: ["date", "date"] },
    { a: "done", b: "todo", offers: ["boss-0"], timings: ["nextSession", "date"] },
    { a: "todo", b: "done", offers: [], timings: ["date", "queued"] },
    { a: "done", b: "done", offers: ["boss-0", "boss-1"], timings: ["nextSession", "nextSession"] },
  ] as const)(
    "waits while lessons it tests are still to do from an earlier day (a: $a, b: $b)",
    ({ a, b, offers, timings }) => {
      const twoPhases = plan({
        graphSkills,
        items: [
          item({ id: "a", on: 0, phase: 0, skillId: "a", status: a }),
          item({ id: "boss-0", kind: "boss", on: 1, phase: 0 }),
          item({ id: "b", on: 2, phase: 1, skillId: "b", status: b }),
          item({ id: "boss-1", kind: "boss", on: 3, phase: 1 }),
        ],
      });

      expect(offered(twoPhases, 5)).toStrictEqual(offers);

      expect(getBossTimings({ plan: twoPhases, today: day(5) })).toStrictEqual(
        new Map([
          ["boss-0", timings[0]],
          ["boss-1", timings[1]],
        ]),
      );
    },
  );

  it("shares its day with its last lessons", () => {
    const items = [
      item({ id: "a", on: 1, phase: 0, skillId: "a" }),
      item({ id: "boss-0", kind: "boss", on: 1, phase: 0 }),
    ];

    expect(offered(plan({ graphSkills, items }), 1)).toStrictEqual(["boss-0"]);
  });

  it("waits for its graph phase's lessons filed under the next phase's time after it", () => {
    const items = [
      item({ id: "a", on: 0, phase: 0, skillId: "a", status: "done" }),
      item({ id: "boss-0", kind: "boss", on: 1, phase: 0 }),
      item({ id: "c", on: 2, phase: 1, skillId: "c" }),
    ];

    const filed = plan({ graphSkills: [...graphSkills, { phase: 0, skillId: "c" }], items });

    expect(offered(filed, 3)).toStrictEqual([]);
  });

  it("doesn't wait in a dated exam for a skill whose core comes after its day", () => {
    const items = [
      item({ id: "a", on: 0, phase: 0, skillId: "a", status: "done" }),
      item({ id: "late-1", on: 0, phase: 0, skillId: "late" }),
      item({ id: "boss-0", kind: "boss", on: 1, phase: 0 }),
      item({ id: "late-2", on: 2, phase: 1, skillId: "late" }),
    ];

    const exam = plan({
      exam: true,
      graphSkills: [
        { phase: 0, skillId: "a" },
        { lessons: 6, phase: 0, skillId: "late" },
      ],
      items,
      phaseEnds: [0, 30],
    });

    expect(offered(exam, 3)).toStrictEqual(["boss-0"]);
  });

  it.each([
    { first: "todo", offers: [] },
    { first: "done", offers: ["boss-0"] },
  ] as const)(
    "counts a dated exam's teaching only through its own window (first lesson $first)",
    ({ first, offers }) => {
      const exam = plan({
        exam: true,
        graphSkills: [{ lessons: 6, phase: 0, skillId: "a" }],
        items: [
          item({ id: "a-1", on: 0, phase: 0, skillId: "a", status: first }),
          item({ id: "boss-0", kind: "boss", on: 1, phase: 0 }),
          item({ id: "a-2", on: 2, phase: 1, skillId: "a" }),
        ],
        phaseEnds: [0, 30],
      });

      expect(offered(exam, 3)).toStrictEqual(offers);
    },
  );

  it("doesn't wait for listening lessons a written challenge doesn't ask", () => {
    const exam = plan({
      exam: true,
      graphSkills: [
        { phase: 0, skillId: "text" },
        { phase: 0, skillId: "heard" },
      ],
      items: [
        item({ id: "text", on: 0, phase: 0, skillId: "text", status: "done" }),
        item({ id: "heard", on: 0, phase: 0, skillId: "heard" }),
        item({ id: "boss-0", kind: "boss", on: 1, phase: 0 }),
      ],
      listeningSkillIds: new Set(["heard"]),
      phaseEnds: [0],
    });

    expect(offered(exam, 3)).toStrictEqual(["boss-0"]);
  });
});
