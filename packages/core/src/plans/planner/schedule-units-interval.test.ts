import { describe, expect, it } from "vitest";
import { addDays } from "./plan-calendar";
import { type QueueUnit } from "./plan-units";
import { type DayShape, type PlanDay, scheduleUnits } from "./schedule-units";

const START = new Date("2020-09-28T00:00:00Z");

function lesson(minutes: number, attrs: Partial<QueueUnit> = {}): QueueUnit {
  return {
    area: "Math",
    chapterId: null,
    key: "lesson:one",
    kind: "lesson",
    lessonId: "one",
    minutes,
    phase: 0,
    skillId: "math",
    title: "One",
    ...attrs,
  };
}

function days(shapes: Partial<DayShape>[]): PlanDay[] {
  return shapes.map((shape, index) => ({
    date: addDays(START, index),
    shape: { events: [], minutes: 20, open: true, phase: null, share: 0.5, ...shape },
  }));
}

describe("scheduled study time across learning intervals", () => {
  it("keeps the same-share conversion and original learning minutes", () => {
    const result = scheduleUnits({ days: days([{}, {}, {}]), units: [lesson(25)] });
    expect(result.dropped).toStrictEqual([]);
    expect(result.units[0]).toMatchObject({ date: START, minutes: 25, studyMinutes: 50 });
  });

  it("counts later practice even when the first course lesson is due on day zero", () => {
    const result = scheduleUnits({ days: days([{ share: 1 }, {}, {}]), units: [lesson(25)] });
    expect(result.units[0]).toMatchObject({ date: START, minutes: 25, studyMinutes: 30 });
    expect(result.dropped).toStrictEqual([]);
  });

  it.each([
    { expected: 25, shares: [0.5, 1] },
    { expected: 25, shares: [1, 0.5] },
  ])("integrates a phase boundary with shares $shares", ({ shares, expected }) => {
    const result = scheduleUnits({
      days: days(shares.map((share, phase) => ({ phase, share }))),
      units: [lesson(5), lesson(20, { key: "lesson:two", lessonId: "two" })],
    });

    expect(result.units[1]).toMatchObject({
      date: addDays(START, 1),
      minutes: 20,
      phase: 1,
      studyMinutes: expected,
    });

    expect(result.units.map((unit) => unit.key)).toStrictEqual(["lesson:one", "lesson:two"]);
    expect(result.dropped).toStrictEqual([]);
  });

  it("skips rest, closed, replaced and reserved capacity without charging their shares", () => {
    const result = scheduleUnits({
      days: days([
        { reserved: 15, share: 1 },
        { minutes: 0 },
        { open: false },
        { events: [{ key: "mock", kind: "mock", minutes: 10, replacesDay: true, title: "" }] },
        { reserved: 10 },
        { share: 0 },
        {},
      ]),
      units: [lesson(15)],
    });

    expect(result.units[0]).toMatchObject({ date: START, studyMinutes: 25 });
    expect(result.events).toHaveLength(1);
  });

  it("excludes unused time before startsAt and an opensDay gap", () => {
    const result = scheduleUnits({
      days: days([{ share: 1 }, {}, { share: 1 }]),
      units: [lesson(5), lesson(15, { key: "lesson:two", opensDay: true, startsAt: 25 })],
    });

    expect(result.units[1]).toMatchObject({ date: addDays(START, 2), studyMinutes: 20 });
  });

  it("starts an opensDay interval after the preceding day's unused minutes", () => {
    const result = scheduleUnits({
      days: days([{ share: 1 }, {}, { share: 1 }]),
      units: [lesson(5), lesson(15, { key: "lesson:two", opensDay: true })],
    });

    expect(result.units[1]).toMatchObject({ date: addDays(START, 2), studyMinutes: 25 });
  });

  it("preserves a held boss's whole single-day duration beyond capacity", () => {
    const result = scheduleUnits({
      days: days([{}, { share: 1 }]),
      units: [lesson(30, { heldOn: 0, key: "boss:0", kind: "boss", lessonId: null })],
    });

    expect(result.units[0]).toMatchObject({ date: START, minutes: 30, studyMinutes: 60 });
  });

  it("keeps the first lesson's overflow when the horizon cannot cover it", () => {
    const result = scheduleUnits({ days: days([{}]), units: [lesson(25)] });
    expect(result.units[0]).toMatchObject({ date: START, minutes: 25, studyMinutes: 50 });
    expect(result.dropped).toStrictEqual([]);
  });

  it("charges consumed shares and keeps uncovered first-lesson time whole", () => {
    const result = scheduleUnits({ days: days([{ share: 1 }, {}]), units: [lesson(40)] });
    expect(result.units[0]).toMatchObject({ date: START, minutes: 40, studyMinutes: 50 });
    expect(result.dropped).toStrictEqual([]);
  });
});
