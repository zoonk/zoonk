import { describe, expect, it } from "vitest";
import { addDays, fromIsoDate } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, scheduleUnits } from "./schedule-units";
import { arrangeStudyCycle } from "./study-cycle";
import { getSubjectsPerDay } from "./study-cycle-lanes";

const START = fromIsoDate("2026-10-05");

/** Study days of `minutes` each, half of it new lessons, like an exam's days before its mocks. */
function studyDays({ count, minutes }: { count: number; minutes: number }): PlanDay[] {
  return Array.from({ length: count }, (_, offset) => ({
    date: addDays(START, offset),
    shape: { events: [], minutes, open: true, phase: 0, share: 0.5 },
  }));
}

function lessons({
  area,
  count,
  minutes = 3,
  skillId = area,
}: {
  area: string;
  count: number;
  minutes?: number;
  skillId?: string;
}): QueueUnit[] {
  return Array.from({ length: count }, (_, index) => ({
    area,
    chapterId: `${skillId}-chapter`,
    key: `lesson:${skillId}-${index}`,
    kind: "lesson",
    lessonId: `${skillId}-${index}`,
    minutes,
    phase: 0,
    skillId,
    title: `${skillId} ${index + 1}`,
  }));
}

/** Each day's subjects in the order of their blocks, by the day `scheduleUnits` puts them on. */
function blocksByDay({ days, units }: { days: PlanDay[]; units: QueueUnit[] }): string[][] {
  const scheduled = scheduleUnits({ days, units }).units;

  return days.map((day) => {
    const areas = scheduled
      .filter((unit) => unit.date.getTime() === day.date.getTime())
      .map((unit) => unit.area);

    return areas.filter((area, index) => index === 0 || areas[index - 1] !== area);
  });
}

const EVEN = new Map(
  ["Português", "Constitucional", "Inglês", "Informática"].map((area) => [area, 1]),
);

describe(getSubjectsPerDay, () => {
  it("covers a few subjects a day: more on long days, one on very short ones", () => {
    expect(
      [15, 30, 60, 90, 120, 150, 180, 240].map((minutes) => getSubjectsPerDay(minutes)),
    ).toStrictEqual([1, 2, 2, 3, 3, 3, 4, 4]);
  });
});

describe(arrangeStudyCycle, () => {
  it("opens with the subjects placement found gaps in, then the ones worth most", () => {
    const units = ["Português", "Constitucional", "Inglês", "Informática"].flatMap((area) =>
      lessons({ area, count: 40 }),
    );

    const days = studyDays({ count: 20, minutes: 60 });

    const rates = new Map([
      ["Português", 1],
      ["Constitucional", 1],
      ["Inglês", 0.6],
      ["Informática", 2],
    ]);

    const heaviest = arrangeStudyCycle({ days, prerequisites: new Map(), rates, units });
    expect(blocksByDay({ days, units: heaviest })[0]).toStrictEqual(["Informática", "Português"]);

    const gaps = arrangeStudyCycle({
      days,
      firstAreas: new Set(["Inglês"]),
      prerequisites: new Map(),
      rates,
      units,
    });

    expect(blocksByDay({ days, units: gaps })[0]).toStrictEqual(["Inglês", "Informática"]);
  });

  it("studies two subjects an hour-long day, in a block each, and brings every one back within days", () => {
    const units = ["Português", "Constitucional", "Inglês", "Informática"].flatMap((area) =>
      lessons({ area, count: 40 }),
    );

    const days = studyDays({ count: 20, minutes: 60 });
    const arranged = arrangeStudyCycle({ days, prerequisites: new Map(), rates: EVEN, units });
    const blocks = blocksByDay({ days, units: arranged });

    // Day one opens with the first subjects of the teaching order: its foundations.
    expect(blocks[0]).toStrictEqual(["Português", "Constitucional"]);
    expect(blocks[1]).toStrictEqual(["Inglês", "Informática"]);
    expect(blocks.slice(0, 10).every((day) => day.length === 2)).toBe(true);

    // Every subject comes back at least every other day.
    const gaps = ["Português", "Constitucional", "Inglês", "Informática"].map((area) => {
      const studied = blocks.flatMap((day, index) => (day.includes(area) ? [index] : []));
      return Math.max(...studied.slice(1).map((day, index) => day - (studied[index] ?? 0)));
    });

    expect(Math.max(...gaps)).toBeLessThanOrEqual(2);

    // Each subject keeps its teaching order.
    const portuguese = arranged.filter((unit) => unit.area === "Português").map((unit) => unit.key);

    expect(portuguese).toStrictEqual(
      lessons({ area: "Português", count: 40 }).map((unit) => unit.key),
    );
  });

  it("gives a subject time in proportion to what it's worth", () => {
    const units = [
      ...lessons({ area: "Direito", count: 200 }),
      ...lessons({ area: "Inglês", count: 200 }),
    ];

    const days = studyDays({ count: 30, minutes: 30 });

    // Half an hour a day studies both subjects every day, Direito in a block three times as long.
    const arranged = arrangeStudyCycle({
      days,
      prerequisites: new Map(),
      rates: new Map([
        ["Direito", 3],
        ["Inglês", 1],
      ]),
      units,
    });

    const placed = scheduleUnits({ days, units: arranged }).units;

    const minutes = (area: string) =>
      placed.filter((unit) => unit.area === area).reduce((total, unit) => total + unit.minutes, 0);

    expect(minutes("Direito") / minutes("Inglês")).toBeCloseTo(3, 0);
  });

  it("brings forward the skills another subject builds on, without holding that subject back", () => {
    const units = [
      ...lessons({ area: "Linguística", count: 30, skillId: "variacao" }),
      ...lessons({ area: "Linguística", count: 10, skillId: "signo" }),
      ...lessons({ area: "Linguística", count: 10, skillId: "redacao-oficial" }),
      ...lessons({ area: "Prova discursiva", count: 10, skillId: "peca-tecnica" }),
      ...lessons({ area: "Português", count: 60 }),
    ];

    const arranged = arrangeStudyCycle({
      days: studyDays({ count: 40, minutes: 60 }),
      prerequisites: new Map([
        ["peca-tecnica", ["redacao-oficial"]],
        ["redacao-oficial", ["signo"]],
      ]),
      rates: new Map([
        ["Linguística", 1],
        ["Português", 1],
        ["Prova discursiva", 1],
      ]),
      units,
    });

    const keys = arranged.map((unit) => unit.key);

    // Official writing, and the sign theory it builds on in its own subject, come before the rest
    // of Linguística, since the discursive test builds on them.
    expect(keys.indexOf("lesson:signo-9")).toBeLessThan(keys.indexOf("lesson:redacao-oficial-0"));

    expect(keys.indexOf("lesson:redacao-oficial-9")).toBeLessThan(
      keys.indexOf("lesson:variacao-0"),
    );

    // The discursive practice itself starts in the first days, beside them.
    expect(keys.indexOf("lesson:peca-tecnica-0")).toBeLessThan(
      keys.indexOf("lesson:redacao-oficial-9"),
    );

    expect(arranged).toHaveLength(units.length);
  });

  it("keeps a subject's own teaching order: a skill waits for the ones before it in its subject", () => {
    const units = [
      ...lessons({ area: "Direito Constitucional", count: 10, skillId: "principios" }),
      ...lessons({ area: "Direito Constitucional", count: 10, skillId: "poder-legislativo" }),
      ...lessons({ area: "Português", count: 20 }),
    ];

    const arranged = arrangeStudyCycle({
      days: studyDays({ count: 20, minutes: 60 }),
      prerequisites: new Map([["poder-legislativo", ["principios"]]]),
      rates: new Map([
        ["Direito Constitucional", 1],
        ["Português", 1],
      ]),
      units,
    });

    const keys = arranged.map((unit) => unit.key);

    expect(keys.indexOf("lesson:poder-legislativo-0")).toBeGreaterThan(
      keys.indexOf("lesson:principios-9"),
    );
  });

  it("lets a long stand-in span days and skips days with no time for new lessons", () => {
    const standIn: QueueUnit = { ...lessons({ area: "Inglês", count: 1 })[0]!, minutes: 45 };
    const mockDay = { events: [], minutes: 60, open: false, phase: 1, share: 0 };

    const days = studyDays({ count: 8, minutes: 30 }).map((day, index) =>
      index === 1 ? { ...day, shape: mockDay } : day,
    );

    const units = [standIn, ...lessons({ area: "Português", count: 20 })];

    const arranged = arrangeStudyCycle({
      days,
      prerequisites: new Map(),
      rates: new Map([
        ["Inglês", 1],
        ["Português", 1],
      ]),
      units,
    });

    const scheduled = scheduleUnits({ days, units: arranged });

    expect(scheduled.dropped).toStrictEqual([]);

    expect(scheduled.units.some((unit) => unit.date.getTime() === days[1]?.date.getTime())).toBe(
      false,
    );

    expect(new Set(arranged.map((unit) => unit.key)).size).toBe(units.length);
  });

  it("leaves a day's last minutes unused rather than start the next day's subject in them", () => {
    const units = [
      ...lessons({ area: "Português", count: 2 }),
      ...lessons({ area: "Direito", count: 6, minutes: 5 }),
      ...lessons({ area: "Inglês", count: 6 }),
    ];

    const days = studyDays({ count: 6, minutes: 30 });

    const arranged = arrangeStudyCycle({
      days,
      prerequisites: new Map(),
      rates: new Map([
        ["Direito", 1],
        ["Inglês", 1],
        ["Português", 1],
      ]),
      units,
    });

    // Português runs out after its two lessons, Direito's next lesson doesn't fit what's left of
    // the day, and Inglês waits for the next day instead of taking those minutes.
    expect(blocksByDay({ days, units: arranged })[0]).toStrictEqual(["Português", "Direito"]);
    expect(scheduleUnits({ days, units: arranged }).dropped).toStrictEqual([]);
  });

  it("keeps each phase's lessons before its checkpoint when the exam has no date", () => {
    const checkpoint: QueueUnit = {
      area: "Português",
      chapterId: null,
      key: "boss:0",
      kind: "boss",
      lessonId: null,
      minutes: 5,
      phase: 0,
      skillId: null,
      title: "Base",
    };

    const later = lessons({ area: "Inglês", count: 4 }).map((unit) => ({ ...unit, phase: 1 }));
    const units = [...lessons({ area: "Português", count: 6 }), checkpoint, ...later];

    const arranged = arrangeStudyCycle({
      days: studyDays({ count: 10, minutes: 30 }),
      prerequisites: new Map(),
      rates: EVEN,
      units,
    });

    expect(arranged.map((unit) => unit.key).indexOf("boss:0")).toBe(6);
  });
});

describe("a study cycle of many subjects", () => {
  it("brings every subject back every few days and gives the heavy ones longer blocks", () => {
    const areas = ["A", "B", "C", "D", "E", "F"];
    const rates = new Map(areas.map((area, index) => [area, index < 2 ? 2 : 1]));
    const units = areas.flatMap((area) => lessons({ area, count: 100 }));
    const days = studyDays({ count: 25, minutes: 120 });

    const arranged = arrangeStudyCycle({ days, prerequisites: new Map(), rates, units });
    const placed = scheduleUnits({ days, units: arranged }).units;
    const blocks = blocksByDay({ days, units: arranged });

    // Until the heavy subjects run out of lessons, near the end, when the others fill the days.
    expect(blocks.slice(0, 20).every((day) => day.length === 3)).toBe(true);

    const firstWeeks = placed.filter((unit) => unit.date < addDays(START, 18));

    const minutes = (area: string) =>
      firstWeeks
        .filter((unit) => unit.area === area)
        .reduce((total, unit) => total + unit.minutes, 0);

    expect(minutes("A") / minutes("F")).toBeCloseTo(2, 0);

    const lastSeen = areas.map((area) => {
      const studied = blocks.flatMap((day, index) => (day.includes(area) ? [index] : []));
      return Math.max(...studied.slice(1).map((day, index) => day - (studied[index] ?? 0)));
    });

    expect(Math.max(...lastSeen)).toBeLessThanOrEqual(3);
  });

  it("starts a subject whose foundations the learner skipped right away, past them, not at its later phase's turn", () => {
    // Portuguese's foundations (phase 0) are known, so only its phase-1 lessons are left.
    const units = [
      ...["Constitucional", "Inglês", "Informática"].flatMap((area) =>
        lessons({ area, count: 40 }),
      ),
      ...lessons({ area: "Português", count: 40 }).map((unit) => ({ ...unit, phase: 1 })),
      ...lessons({ area: "Processo", count: 40 }).map((unit) => ({ ...unit, phase: 2 })),
    ];

    const days = studyDays({ count: 20, minutes: 120 });

    const arranged = arrangeStudyCycle({
      areaPhases: new Map([
        ["Constitucional", 0],
        ["Inglês", 0],
        ["Informática", 0],
        ["Português", 0],
        ["Processo", 2],
      ]),
      days,
      prerequisites: new Map(),
      rates: new Map([...EVEN, ["Processo", 1]]),
      units,
    });

    const blocks = blocksByDay({ days, units: arranged });

    expect(blocks.slice(0, 2).flat()).toContain("Português");
    // A subject that sits in a later phase of the graph still waits for its turn.
    expect(blocks.slice(0, 2).flat()).not.toContain("Processo");
  });
});

/** Minutes each area gets on the first `count` days `scheduleUnits` lays the units on. */
function minutesByArea({
  count,
  days,
  units,
}: {
  count: number;
  days: PlanDay[];
  units: QueueUnit[];
}): Map<string, number> {
  const last = days[count - 1]?.date.getTime() ?? 0;

  return scheduleUnits({ days, units })
    .units.filter((unit) => unit.date.getTime() <= last)
    .reduce(
      (areas, unit) => areas.set(unit.area, (areas.get(unit.area) ?? 0) + unit.minutes),
      new Map<string, number>(),
    );
}

describe("a subject whose lessons come out of their skills' order", () => {
  /*
   * A chapter shared by two skills is planned where the first is taught, but its later lessons
   * count for the second, which builds on a skill taught after it in the same subject (Lucas's
   * Natureza and Matemática: "Contagem por casos" needed skills 78 and 107 places later). The
   * subject must never wait on its own later lessons while an always-ready one takes its days.
   */
  it("studies its prerequisites first instead of waiting while other subjects take its days", () => {
    const units = [
      ...lessons({ area: "Natureza", count: 2, skillId: "genetica" }),
      ...lessons({ area: "Natureza", count: 30, skillId: "celulas" }),
      ...lessons({ area: "Natureza", count: 30, skillId: "hereditariedade" }),
      ...lessons({ area: "Natureza", count: 30, skillId: "genetica" }).map((unit) => ({
        ...unit,
        key: `${unit.key}-b`,
        lessonId: `${unit.lessonId}-b`,
      })),
      ...lessons({ area: "Matemática", count: 60 }),
      ...lessons({ area: "Redação", count: 60 }),
    ];

    const days = studyDays({ count: 12, minutes: 180 });

    const arranged = arrangeStudyCycle({
      days,
      prerequisites: new Map([
        ["genetica", ["hereditariedade"]],
        ["hereditariedade", ["celulas"]],
      ]),
      rates: new Map([
        ["Natureza", 1],
        ["Matemática", 1],
        ["Redação", 1],
      ]),
      units,
    });

    const firstWeek = minutesByArea({ count: 5, days, units: arranged });
    const total = [...firstWeek.values()].reduce((sum, minutes) => sum + minutes, 0);

    // Each subject gets about a third of the first days, as their equal worth says.
    expect((firstWeek.get("Natureza") ?? 0) / total).toBeGreaterThan(0.25);
    expect((firstWeek.get("Redação") ?? 0) / total).toBeLessThan(0.42);

    // A skill still comes after the ones it builds on.
    const keys = arranged.map((unit) => unit.key);

    expect(keys.indexOf("lesson:genetica-0")).toBeGreaterThan(
      keys.indexOf("lesson:hereditariedade-29"),
    );

    expect(keys.indexOf("lesson:hereditariedade-0")).toBeGreaterThan(
      keys.indexOf("lesson:celulas-29"),
    );
  });

  it("keeps filling a day when only lessons stuck on a prerequisite cycle are left", () => {
    const units = [
      ...lessons({ area: "Linguística", count: 10, skillId: "fonetica" }),
      ...lessons({ area: "Linguística", count: 10, skillId: "fonologia" }),
    ];

    const days = studyDays({ count: 10, minutes: 60 });

    // A cycle the graph normalizer missed: each skill names the other as its prerequisite.
    const arranged = arrangeStudyCycle({
      days,
      prerequisites: new Map([
        ["fonetica", ["fonologia"]],
        ["fonologia", ["fonetica"]],
      ]),
      rates: new Map([["Linguística", 1]]),
      units,
    });

    // Half an hour of new lessons a day: ten 3-minute lessons, not one.
    expect(minutesByArea({ count: 1, days, units: arranged }).get("Linguística")).toBe(30);
  });
});
