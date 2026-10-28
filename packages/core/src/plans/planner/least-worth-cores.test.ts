import { describe, expect, it } from "vitest";
import { scheduleCoresFirst } from "./least-worth-cores";
import { type QueueUnit } from "./plan-units";

function core(skillId: string, attrs: Partial<QueueUnit> = {}): QueueUnit {
  return {
    area: "Biology",
    chapterId: "chapter",
    key: `lesson:${skillId}`,
    kind: "lesson",
    lessonId: skillId,
    minutes: 20,
    phase: 0,
    skillId,
    title: skillId,
    ...attrs,
  };
}

function scheduleWithin(minutes: number) {
  return (units: readonly QueueUnit[]) => {
    const ends = units.map((_, index) =>
      units.slice(0, index + 1).reduce((sum, unit) => sum + unit.minutes, 0),
    );

    return {
      dropped: units.filter((_, index) => (ends[index] ?? 0) > minutes),
      units: units.filter((_, index) => (ends[index] ?? 0) <= minutes),
    };
  };
}

function worthOf({
  announced = [],
  gaps = [],
  known = [],
  levels = {},
  prerequisites = {},
  topics = {},
  units,
}: {
  announced?: string[];
  gaps?: string[];
  known?: string[];
  levels?: Record<string, number>;
  prerequisites?: Record<string, string[]>;
  topics?: Record<string, number>;
  units: readonly QueueUnit[];
}) {
  const skillIds = units.flatMap((unit) => (unit.skillId ? [unit.skillId] : []));

  return {
    announcedTopics: new Set<string>(),
    focused: new Set<string>(),
    gaps: new Set(gaps),
    known: new Set(known),
    prerequisites: new Map(Object.entries(prerequisites)),
    topics: new Map(
      skillIds.map((skillId) => [
        skillId,
        Array.from({ length: topics[skillId] ?? 1 }, (_, index) => ({
          key: `biology|${skillId}-${index}`,
          score: levels[skillId] ?? (announced.includes(skillId) ? 1 : 3),
        })),
      ]),
    ),
    values: new Map(skillIds.map((skillId) => [skillId, 1])),
  };
}

function placedSkills(schedule: { units: readonly QueueUnit[] }) {
  return schedule.units.map((unit) => unit.skillId);
}

describe(scheduleCoresFirst, () => {
  it("keeps a missed topic whose own way fits when a topic built on it doesn't", () => {
    const units = [core("meaning"), core("reading"), core("rewriting"), core("spelling")];

    const schedule = scheduleCoresFirst({
      schedulePending: scheduleWithin(40),
      units,
      worth: worthOf({
        gaps: ["meaning"],
        prerequisites: { rewriting: ["meaning", "reading"] },
        topics: { rewriting: 3 },
        units,
      }),
    });

    expect(placedSkills(schedule)).toStrictEqual(["meaning", "reading"]);
  });

  it("ranks a topic by its own announcement, not by that of a base it builds on", () => {
    const units = [
      core("membrane", { announced: true, minutes: 10 }),
      core("transport"),
      core("osmosis", { announced: true, minutes: 30 }),
    ];

    const schedule = scheduleCoresFirst({
      schedulePending: scheduleWithin(30),
      units,
      worth: worthOf({
        announced: ["membrane", "osmosis"],
        levels: { membrane: 1, osmosis: 2, transport: 3 },
        prerequisites: { transport: ["membrane"] },
        units,
      }),
    });

    expect(placedSkills(schedule)).toStrictEqual(["osmosis"]);
  });

  it("never keeps a known topic for riding on a base the learner doesn't know", () => {
    const units = [core("genres"), core("correspondence", { minutes: 30 }), core("meaning")];

    const schedule = scheduleCoresFirst({
      schedulePending: scheduleWithin(50),
      units,
      worth: worthOf({
        known: ["correspondence"],
        levels: { correspondence: 2, genres: 2, meaning: 2 },
        prerequisites: { correspondence: ["genres"] },
        topics: { correspondence: 4 },
        units,
      }),
    });

    expect(placedSkills(schedule)).toStrictEqual(["genres", "meaning"]);
  });

  it("never holds the time for a way in whose bases alone take it", () => {
    const units = [
      core("prokaryotes", { minutes: 4 }),
      core("organelles", { announced: true, minutes: 36 }),
      core("membrane", { minutes: 4 }),
      core("viruses", { minutes: 4 }),
    ];

    const schedule = scheduleCoresFirst({
      schedulePending: scheduleWithin(4),
      units,
      worth: worthOf({
        gaps: ["membrane", "viruses"],
        levels: { membrane: 2, organelles: 2, prokaryotes: 2, viruses: 2 },
        prerequisites: { organelles: ["prokaryotes"] },
        units,
      }),
    });

    expect(placedSkills(schedule)).toStrictEqual(["membrane"]);
  });

  it("lets work earlier days left give way to a topic asked more", () => {
    const carried = [core("syntax")];
    const units = [core("meaning")];

    const schedule = scheduleCoresFirst({
      carried,
      schedulePending: scheduleWithin(0),
      units,
      worth: worthOf({ levels: { meaning: 3, syntax: 1 }, units: [...carried, ...units] }),
    });

    expect(schedule.yielded).toStrictEqual(["lesson:syntax"]);
  });

  it("never lets the chapter in progress give way", () => {
    const carried = [core("syntax", { inProgress: true })];
    const units = [core("meaning")];

    const schedule = scheduleCoresFirst({
      carried,
      schedulePending: scheduleWithin(0),
      units,
      worth: worthOf({ levels: { meaning: 3, syntax: 1 }, units: [...carried, ...units] }),
    });

    expect(schedule.yielded).toStrictEqual([]);
  });
});
