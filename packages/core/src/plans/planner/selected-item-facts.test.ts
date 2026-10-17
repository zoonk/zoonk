import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";
import { listSelectedItemFacts } from "./selected-item-facts";

const EPSILON = 1e-9;

/** An exam of three skills, the first taught across every phase, a mock a week. */
function examInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2026-11-08") },
    graph: {
      phases: [{ milestone: null, name: "Everything" }],
      skills: [5, 1, 3].map((weight, index) => ({
        area: null,
        lessons: 2,
        name: `Skill s${index + 1}`,
        phase: 0,
        skillId: `s${index + 1}`,
        weight,
      })),
    },
    items: [],
    lessons: Array.from({ length: 400 }, (_, index) => ({
      chapterId: "chapter",
      lessonId: `l${index}`,
      minutes: index % 50 === 0 ? 70 : 3,
      skillIds: ["s1"],
      title: `Lesson l${index}`,
    })),
    mockMinutes: 45,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["s3", ["s2"]]]),
    readiness: new Map(),
    settings: parsePlanSettings({
      startDate: "2026-09-23",
      weekdayMinutes: [0, 45, 45, 45, 45, 45, 45],
    }),
    today: fromIsoDate("2026-09-23"),
    ...attrs,
  };
}

function sumParts(parts: {
  checkpoint: number;
  practice: number;
  unwritten: number;
  written: number;
}) {
  return parts.checkpoint + parts.practice + parts.unwritten + parts.written;
}

describe(listSelectedItemFacts, () => {
  const input = examInput();
  const built = buildPlan(input);
  const facts = listSelectedItemFacts({ built, input });

  it("splits every item's minutes into parts that add up to them", () => {
    expect(facts.size).toBe(built.items.length);

    const off = built.items.filter((item) => {
      const fact = facts.get(item.key);
      return !fact || Math.abs(sumParts(fact.parts) - item.minutes) > EPSILON;
    });

    expect(off).toStrictEqual([]);
  });

  it("gives a lesson longer than a day its days, which add up to its minutes", () => {
    const long = built.items.filter((item) => facts.get(item.key)?.days);

    expect(long.length).toBeGreaterThan(0);

    for (const item of long) {
      const fact = facts.get(item.key);
      const days = fact?.days ?? [];

      expect(days.reduce((sum, [, minutes]) => sum + minutes, 0)).toBeCloseTo(item.minutes, 9);

      expect(days.reduce((sum, day) => sum + day[2], 0)).toBeCloseTo(fact?.parts.written ?? 0, 9);

      // A lesson is dated by the day it's due; its time runs later only when it can't end by then.
      expect(fact?.teachingEnd ?? toIsoDate(item.scheduledFor ?? new Date(0))).toBe(
        days.at(-1)?.[0],
      );
    }
  });

  it("sizes challenges from the bank, and keeps a listening one with too few recordings waiting", () => {
    const withBank = examInput({
      bossFacts: {
        bank: { recordingSets: [], textCounts: new Map([["s1", 30]]) },
        listeningSkillIds: new Set(["s2", "s3"]),
        rows: { chapterLessons: [], lessonSkills: [] },
        survivors: new Map(),
      },
      // Keep the bank/recording contract independent of the later multi-phase ownership rule.
      lessons: input.lessons.slice(1, 5),
    });

    const sized = buildPlan(withBank);
    const bosses = listSelectedItemFacts({ built: sized, input: withBank });
    const first = sized.items.find((item) => item.kind === "boss");

    // Its phase teaches s1's lessons and s2's and s3's stand-ins; only s1 has text questions.
    expect(bosses.get(first?.key ?? "")?.boss).toMatchObject({
      kind: "text",
      questions: 10,
      waiting: false,
    });

    expect(bosses.get(first?.key ?? "")?.boss?.testedSkillIds.toSorted()).toStrictEqual([
      "s1",
      "s2",
      "s3",
    ]);

    const listening = {
      ...withBank,
      bossFacts: { ...withBank.bossFacts, listeningSkillIds: new Set(["s1", "s2", "s3"]) },
    } as BuildPlanInput;

    const heard = buildPlan(listening);
    const waiting = listSelectedItemFacts({ built: heard, input: listening });
    const boss = heard.items.find((item) => item.kind === "boss");

    expect(waiting.get(boss?.key ?? "")?.boss).toMatchObject({
      kind: "recording",
      minutes: 0,
      questions: null,
      waiting: true,
    });
  });
});
