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

/** Lays units out in order until `minutes` are taken, as a deadline does. */
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

/** Every skill's topics asked most ("high"), one per skill unless `topics` says more. */
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
  // Rewriting texts builds on word meaning, which the learner missed, and on reading. All three
  // didn't fit, and skipped whole, word meaning left with them while a topic the learner didn't
  // miss kept the time it would have fit in. Reading, asked as often as spelling, keeps the time
  // left for its own topic: it comes first in teaching order.
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

  // A topic the teacher announced ranks above any other, but one it's only a base of doesn't: an
  // unannounced topic built on the announced cell membrane took the time of the announced osmosis
  // essay.
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

  // Câmara at 180 minutes a day (seed 2070): official correspondence, which the
  // learner showed they know, kept 11 lessons while word meaning, which they didn't, stayed out.
  // It builds on text genres, which they didn't know either, and with its four topics, the two
  // together were the cheapest way per topic.
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

  // A class test three days away at 30 minutes a day (seed 2059): the 4 minutes left
  // went to prokaryotes, the base of the announced organelles, which needed 36 more and never came
  // in, while the cell membrane, which the learner missed, would have fit whole.
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

  // Câmara's learner came back after three days at 180 minutes and cut their time to 15: the
  // missed days' lessons, on a topic asked less, went first and pushed out one asked more.
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

  // The chapter the learner is in keeps its lessons whatever its topic's rank.
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
