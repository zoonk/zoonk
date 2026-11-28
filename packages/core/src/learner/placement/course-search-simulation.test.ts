import { describe, expect, it } from "vitest";
import {
  type CourseSearchAnswer,
  type CourseSearchTopic,
  courseOpeningPosition,
  courseProbePositions,
  courseSearch,
} from "./course-search";

function chain(count: number, bank: number, areas = 1): CourseSearchTopic[] {
  const positions = new Set(courseProbePositions(count, bank));

  return Array.from({ length: count }, (_, index) => ({
    askable: true,
    id: String(index),
    itemIds: positions.has(index) ? [String(2 * index), String(2 * index + 1)] : [],
    lessons: 1,
    sectionTitle: String(Math.floor((index * areas) / count)),
  }));
}

type Profile = "calibrated" | "novice" | "overclaim" | "guessable" | "cue" | "islands";

function openingPosition(position: number | null) {
  if (position === null) {
    return courseOpeningPosition(null);
  }

  if (position === 0.25) {
    return courseOpeningPosition("basic");
  }

  return position;
}

const SEEDS = [42, 8506, 29_009, 71_455, 98_179];
const GUESS_RATES = [1 / 24, 1 / 24, 1 / 32];

function sample(
  count: number,
  bank: number,
  profile: Profile,
  position: number | null,
  initialSeed: number,
) {
  let seed = initialSeed;
  const all = courseProbePositions(count);
  const sorted = all.toSorted((a, b) => a - b);
  const target = openingPosition(position) * (count - 1);
  const opening = sorted.reduce((a, b) => (Math.abs(a - target) <= Math.abs(b - target) ? a : b));
  const index = sorted.indexOf(opening);

  const ready = new Set(
    [...new Set([...sorted.slice(Math.max(0, index - 1), index + 2), ...all])].slice(0, bank),
  );

  const topics = chain(count, 16).map((topic, i) =>
    ready.has(i) ? topic : { ...topic, itemIds: [] },
  );

  let learnersWithKnowledge = 0,
    missedAll = 0,
    recoveredPerLearner = 0;

  function draw() {
    seed = (seed * 1_664_525 + 1_013_904_223) % 2 ** 32;
    return seed / 2 ** 32;
  }

  let high = 0;
  let known = 0;
  let found = 0;
  let short = 0;
  let longest = 0;
  const states = new Map<number, ReturnType<typeof courseSearch>>();
  const draws = 10_000;

  for (let trial = 0; trial < draws; trial += 1) {
    const center = profile === "overclaim" ? 0.1 : position;

    const fraction =
      center === null
        ? draw() * 0.85
        : center + 0.2 * Math.sqrt(-2 * Math.log(1 - draw())) * Math.cos(2 * Math.PI * draw());

    const boundary =
      profile === "novice" ? 0 : Math.min(count, Math.max(0, Math.round(count * fraction)));

    const island = profile === "islands" ? 0.08 : 0.03;

    const skills = topics.map(
      (_, i) => draw() < (i < boundary ? 0.9 : island) && profile !== "novice",
    );

    const guess = profile === "guessable" || profile === "cue" ? 0.12 : null;

    const responses = skills.flatMap((learned, i) => {
      const first = draw() < (learned ? 0.85 : (guess ?? GUESS_RATES[i % 3]!));
      const second = draw() < (learned ? 0.85 : (guess ?? GUESS_RATES[(i + 1) % 3]!));
      const cue = draw() < 0.3 && profile === "cue" && !learned && first;
      return [first, second || cue];
    });

    const answers: CourseSearchAnswer[] = [];
    const ceiling = Math.min(8, count * 2);
    let path = 1;

    for (;;) {
      const state =
        states.get(path) ??
        courseSearch({ answers, ceiling, position: openingPosition(position), topics });

      states.set(path, state);

      if (!state.itemId) {
        const start = topics.findIndex((topic) => !state.startedPast.has(topic.id));
        high += Number(start >= boundary + 3);
        short += Number(start === 0 && answers.length <= 3);
        longest = Math.max(longest, answers.length);
        const knownCount = skills.slice(0, boundary).filter(Boolean).length;
        const recoveredCount = skills.slice(0, Math.min(start, boundary)).filter(Boolean).length;
        known += knownCount;
        found += recoveredCount;

        if (knownCount > 0) {
          learnersWithKnowledge += 1;
          recoveredPerLearner += recoveredCount / knownCount;
          missedAll += Number(recoveredCount === 0);
        }

        break;
      }

      if (answers.length >= ceiling || answers.some((a) => a.itemId === state.itemId)) {
        throw new Error("The search exceeded the ceiling or repeated an item.");
      }

      const correct = responses[Number(state.itemId)] ?? false;
      path = 2 * path + Number(correct);
      answers.push({ correct, itemId: state.itemId });
    }
  }

  return {
    found: known ? found / known : 0,
    high: high / draws,
    learnerFound: recoveredPerLearner / (learnersWithKnowledge || 1),
    longest,
    missedAll: missedAll / (learnersWithKnowledge || 1),
    short: short / draws,
  };
}

function estimate(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  const margin =
    2 *
    Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        (values.length * (values.length - 1)),
    );

  return { margin, mean };
}

function simulate(count: number, bank: number, profile: Profile, position: number | null) {
  const rows = SEEDS.map((seed) => sample(count, bank, profile, position, seed));
  const stat = (key: keyof (typeof rows)[number]) => estimate(rows.map((row) => row[key]));

  const result = {
    found: stat("found").mean,
    foundMargin: stat("found").margin,
    high: stat("high").mean,
    highMargin: stat("high").margin,
    learnerFound: stat("learnerFound").mean,
    longest: Math.max(...rows.map((row) => row.longest)),
    missedAll: stat("missedAll").mean,
    short: stat("short").mean,
    shortMargin: stat("short").margin,
  };

  process.stdout.write(`${JSON.stringify({ bank, count, position, profile, ...result })}\n`);
  return result;
}

describe("course search on a frozen bank", () => {
  const positions = [0.25, 0.5, 0.75, null];

  const courses = [1, 8, 12, 40, 150].flatMap((count) =>
    positions.map((position) => ({ count, position })),
  );

  it.each(courses)(
    "measures calibrated learners on $count topics at $position",
    ({ count, position }) => {
      simulate(count, 4, "calibrated", position);
      simulate(count, 8, "calibrated", position);
      const measured = simulate(count, 16, "calibrated", position);

      expect(measured.longest).toBeLessThanOrEqual(Math.min(8, count * 2));

      const overshootGate = new Map([
        [12, 0.03],
        [40, 0.03],
        [150, 0.05],
      ]).get(count);

      if (overshootGate !== undefined) {
        assertOvershoot(measured.high + measured.highMargin, overshootGate);
      }

      if (count === 40) {
        assertRecovery(measured.found - measured.foundMargin);
      }
    },
  );

  it.each([8, 16])("ends at lesson one for novices with a %i-topic bank", (bank) => {
    const measured = simulate(40, bank, "novice", 0.75);
    expect(measured.short - measured.shortMargin).toBeGreaterThanOrEqual(0.85);
  });

  it.each(["cue", "guessable", "overclaim", "islands"] as const)(
    "protects a %s learner",
    (profile) => {
      const measured = simulate(40, 16, profile, profile === "overclaim" ? 0.75 : 0.5);
      expect(measured.high + measured.highMargin).toBeLessThanOrEqual(0.08);
    },
  );
});

function verifyEveryExit(topics: readonly CourseSearchTopic[], answers: CourseSearchAnswer[] = []) {
  const ceiling = Math.min(topics.length * 2, 8);
  const state = courseSearch({ answers, ceiling, position: 0.5, topics });
  const evidence = new Map(answers.map((answer) => [answer.itemId, answer.correct]));
  const skipped = topics.filter((topic) => state.startedPast.has(topic.id));

  for (const topic of skipped) {
    const area = topics.filter((other) => other.sectionTitle === topic.sectionTitle);

    const firstMiss = area.findIndex((other) =>
      other.itemIds.some((id) => evidence.get(id) === false),
    );

    const end = firstMiss === -1 ? area.length : firstMiss;
    const possibleBoundaries = area.slice(area.indexOf(topic), end);
    expect(topic.askable).toBe(true);
    expect(topic).not.toBe(topics.at(-1));

    expect(possibleBoundaries.some((other) => other.itemIds.some((id) => evidence.get(id)))).toBe(
      true,
    );

    expect(
      topics
        .slice(topics.indexOf(topic))
        .some((other) => new Set(other.itemIds.filter((id) => evidence.get(id))).size >= 2),
    ).toBe(true);
  }

  expect(state.itemId && evidence.has(state.itemId)).toBeFalsy();
  expect(answers.length + Number(Boolean(state.itemId))).toBeLessThanOrEqual(ceiling);

  if (state.itemId) {
    for (const correct of [true, false]) {
      verifyEveryExit(topics, [...answers, { correct, itemId: state.itemId }]);
    }
  }
}

describe("every stopping point", () => {
  it("ends after confirming the penultimate topic on an all-right five-topic course", () => {
    const topics = chain(5, 5);
    const answers: CourseSearchAnswer[] = [];

    while (answers.length < 8) {
      const { itemId } = courseSearch({ answers, ceiling: 8, position: 0.5, topics });

      if (!itemId) {
        break;
      }

      answers.push({ correct: true, itemId });
    }

    expect(answers.map((answer) => answer.itemId)).toStrictEqual(["4", "5", "6", "7"]);
  });

  it.each([1, 2, 3, 4, 5])(
    "keeps every early exit in %i independent areas inside its proven boundary",
    (areas) => {
      const topics = chain(40, 16, areas).map((topic, i) =>
        i === 3 ? { ...topic, askable: false, itemIds: [] } : topic,
      );

      expect.hasAssertions();
      verifyEveryExit(topics);

      if (areas > 1) {
        verifyEveryExit(topics.map((topic, i) => ({ ...topic, sectionTitle: String(i % areas) })));
      }
    },
  );

  it("checks every stopping point on the 303-lesson physics plan", () => {
    const lessonCounts = [
      2, 1, 2, 2, 21, 12, 21, 12, 12, 16, 21, 31, 10, 46, 34, 13, 13, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2,
      1, 2, 2, 2, 2, 2, 2, 2,
    ];

    expect(lessonCounts.reduce((sum, lessons) => sum + lessons, 0)).toBe(303);

    verifyEveryExit(
      chain(lessonCounts.length, 16).map((topic, i) => ({ ...topic, lessons: lessonCounts[i]! })),
    );
  });
});

function assertRecovery(found: number) {
  expect(found).toBeGreaterThanOrEqual(0.75);
}

function assertOvershoot(value: number, limit: number) {
  expect(value).toBeLessThanOrEqual(limit);
}

const areaCases = [12, 40, 150].flatMap((count) =>
  (count === 12 ? [2, 3] : [2, 3, 5]).flatMap((areas) =>
    ["sequential", "interleaved"].flatMap((layout) =>
      ["prefix", "uneven"].map((profile) => ({ areas, count, layout, profile })),
    ),
  ),
);

describe("knowledge across syllabus modules", () => {
  it.each(areaCases)(
    "measures $profile learners on $count topics in $areas $layout areas",
    ({ count, areas, layout, profile }) => {
      const topics = chain(count, 16, areas).map((topic, index) => ({
        ...topic,
        sectionTitle: layout === "interleaved" ? String(index % areas) : topic.sectionTitle,
      }));

      const groups = [...Map.groupBy(topics, (topic) => topic.sectionTitle).values()];
      const states = new Map<number, ReturnType<typeof courseSearch>>();
      let seed = 0;

      const draw = () => {
        seed = (seed * 1_664_525 + 1_013_904_223) % 2 ** 32;
        return seed / 2 ** 32;
      };

      let learnerFound = 0,
        missedAll = 0,
        withKnowledge = 0;

      const highBySeed: number[] = [];

      let found = 0,
        high = 0,
        known = 0;

      for (let trial = 0; trial < SEEDS.length * 10_000; trial += 1) {
        if (trial % 10_000 === 0) {
          seed = SEEDS[trial / 10_000]!;
        }

        const fraction = Math.max(
          0,
          Math.min(
            1,
            0.5 + 0.2 * Math.sqrt(-2 * Math.log(1 - draw())) * Math.cos(2 * Math.PI * draw()),
          ),
        );

        const strong = Math.floor(draw() * areas),
          weak = (strong + 1) % areas;

        const ends = groups.map((group, area) => {
          if (profile === "prefix") {
            return group.filter((topic) => Number(topic.id) < Math.round(count * fraction)).length;
          }

          const extent = area === strong ? 0.75 + draw() * 0.25 : fraction;

          if (area === weak) {
            return Math.round(group.length * draw() * 0.25);
          }

          return Math.round(group.length * extent);
        });

        const prefix = new Set(
          groups.flatMap((group, area) => group.slice(0, ends[area]).map((topic) => topic.id)),
        );

        const learned = topics.map((topic) => draw() < (prefix.has(topic.id) ? 0.9 : 0.03));

        const responses = learned.flatMap((learnedTopic, i) => [
          draw() < (learnedTopic ? 0.85 : GUESS_RATES[i % 3]!),
          draw() < (learnedTopic ? 0.85 : GUESS_RATES[(i + 1) % 3]!),
        ]);

        const answers: CourseSearchAnswer[] = [];
        let path = 1;

        for (;;) {
          const state =
            states.get(path) ?? courseSearch({ answers, ceiling: 8, position: 0.5, topics });

          states.set(path, state);

          if (!state.itemId) {
            const overshot = Number(
              groups.some(
                (group, i) =>
                  group.filter((topic) => state.startedPast.has(topic.id)).length >= ends[i]! + 3,
              ),
            );

            high += overshot;
            const seedIndex = Math.floor(trial / 10_000);
            highBySeed[seedIndex] = (highBySeed[seedIndex] ?? 0) + overshot;

            const knownTopics = topics.filter(
              (topic) => prefix.has(topic.id) && learned[Number(topic.id)],
            );

            known += knownTopics.length;
            const recovered = knownTopics.filter((topic) => state.startedPast.has(topic.id)).length;
            found += recovered;

            if (knownTopics.length > 0) {
              withKnowledge += 1;
              learnerFound += recovered / knownTopics.length;
              missedAll += Number(recovered === 0);
            }

            break;
          }

          if (answers.length >= 8) {
            throw new Error("Question ceiling exceeded");
          }

          const correct = responses[Number(state.itemId)]!;
          answers.push({ correct, itemId: state.itemId });
          path = path * 2 + Number(correct);
        }
      }

      const gate =
        profile === "prefix"
          ? new Map([
              [12, 0.03],
              [40, 0.03],
              [150, 0.05],
            ]).get(count)
          : new Map([
              [12, 0.08],
              [40, 0.08],
            ]).get(count);

      process.stdout.write(
        `${JSON.stringify({
          areas,
          count,
          found: found / known,
          high: high / (SEEDS.length * 10_000),
          layout,
          learnerFound: learnerFound / withKnowledge,
          missedAll: missedAll / withKnowledge,
          profile,
        })}\n`,
      );

      expect(found).toBeGreaterThan(0);

      if (gate !== undefined) {
        const estimateHigh = estimate(highBySeed.map((total) => total / 10_000));
        assertOvershoot(estimateHigh.mean + estimateHigh.margin, gate);
      }
    },
  );
});
