import { type OwnLevel } from "./placement-steps";

const SEARCH_SPLIT = { aboveRight: 0.3, belowMiss: 0.65 };
const OPENING_POSITION = { advanced: 0.75, basic: 0.3, intermediate: 0.5, none: 0, unsure: 0.45 };
const MAX_ANSWERS = 8;
const MAX_PROBES = 16;

export type CourseSearchTopic = {
  id: string;
  sectionTitle: string | null;
  lessons: number;
  askable: boolean;
  itemIds: readonly string[];
};

export type CourseSearchAnswer = { itemId: string; correct: boolean };

export function courseOpeningPosition(level: OwnLevel | null): number {
  return OPENING_POSITION[level ?? "unsure"];
}

export function courseProbePositions(count: number, limit = MAX_PROBES): number[] {
  if (count === 0) {
    return [];
  }

  const positions = count === 1 ? [0] : [0, count - 1];

  while (positions.length < Math.min(count, limit)) {
    const ordered = positions.toSorted((a, b) => a - b);
    let left = 0;
    let width = 0;

    for (const [index, right] of ordered.entries()) {
      const previous = ordered[index - 1] ?? right;

      if (right - previous > width) {
        left = previous;
        width = right - previous;
      }
    }

    const middle = left + width / 2;
    positions.push(left + width === count - 1 ? Math.ceil(middle) : Math.floor(middle));
  }

  return positions.slice(0, limit);
}

function readProbes(topics: readonly CourseSearchTopic[], history: ReadonlyMap<string, boolean>) {
  return topics.map((topic, index) => {
    const itemIds = [...new Set(topic.itemIds)];
    const answers = itemIds.map((id) => history.get(id)).filter((value) => value !== undefined);
    return { answers, index, itemIds, topic };
  });
}

function nearestProbe(candidates: ReturnType<typeof readProbes>, target: number) {
  return candidates.reduce<(typeof candidates)[number] | null>(
    (nearest, probe) =>
      !nearest || Math.abs(probe.index - target) < Math.abs(nearest.index - target)
        ? probe
        : nearest,
    null,
  );
}

function searchBounds(probes: ReturnType<typeof readProbes>) {
  const answers = probes.reduce((total, probe) => total + probe.answers.length, 0);
  const miss = probes.find((probe) => probe.answers.includes(false))?.index ?? probes.length;
  const right = probes.filter((probe) => probe.index < miss && probe.answers.includes(true));
  const boundary = right.findLast((probe) => probe.answers.length >= 2)?.index ?? -1;
  const high = right.at(-1);
  const low = high?.index ?? -1;

  const candidates = probes.filter(
    (probe) =>
      probe.index > low && probe.index < miss && probe.topic.askable && probe.itemIds.length >= 2,
  );

  const confirm = high && high.answers.length === 1 ? high.itemIds[1] : undefined;

  return { answers, boundary, candidates, confirm, low, miss, right };
}

function searchArea(
  topics: readonly CourseSearchTopic[],
  history: ReadonlyMap<string, boolean>,
  position: number,
  remaining: number,
) {
  const probes = readProbes(topics, history);
  const { answers, boundary, candidates, confirm, low, miss, right } = searchBounds(probes);
  const openingMisses = answers >= 2 && !probes.some((probe) => probe.answers.includes(true));
  const split = miss < topics.length ? SEARCH_SPLIT.belowMiss : SEARCH_SPLIT.aboveRight;
  const target = answers === 0 ? position * (topics.length - 1) : low + split * (miss - low);

  const best = nearestProbe(candidates, target);

  let itemId = best?.topic.itemIds[0] ?? confirm;

  if (openingMisses) {
    itemId = candidates[0]?.topic.itemIds[0];
  } else if (confirm && (remaining <= 2 || miss - low <= 3 || !best)) {
    itemId = confirm;
  }

  return { answers, boundary, itemId };
}

export function courseSearch({
  topics,
  answers,
  position,
  ceiling,
}: {
  topics: readonly CourseSearchTopic[];
  answers: readonly CourseSearchAnswer[];
  position: number;
  ceiling: number;
}) {
  const byArea = Map.groupBy(topics, (topic) => topic.sectionTitle);
  const limit = Math.min(MAX_ANSWERS, ceiling);
  const history = new Map<string, boolean>();
  let state = searchArea(topics, history, position, limit);

  for (const answer of answers) {
    history.set(answer.itemId, answer.correct);

    if (byArea.size === 1 || state.boundary < 0) {
      state = searchArea(topics, history, position, limit - history.size);
    }
  }

  const covered = topics
    .slice(0, Math.min(state.boundary + 1, Math.max(0, topics.length - 1)))
    .filter((topic) => topic.askable);

  const startedPast = new Set<string>();
  let itemId = state.itemId;

  if (byArea.size <= 1) {
    for (const topic of covered) {startedPast.add(topic.id);}
  } else if (state.boundary >= 0) {
    const before = new Set(covered);
    let largest = -1;
    itemId = undefined;

    for (const group of byArea.values()) {
      const miss = group.findIndex((topic) =>
        topic.itemIds.some((id) => history.get(id) === false),
      );

      const safe = miss === -1 ? group : group.slice(0, miss);

      const right = safe.findLastIndex((topic) =>
        topic.itemIds.some((id) => history.get(id) === true),
      );

      for (const topic of safe.slice(0, right + 1))
        {if (before.has(topic)) startedPast.add(topic.id);}
      if (right === -1 && miss === -1) {
        const pending = safe.filter((topic) => before.has(topic));
        const latest = pending.findLast((topic) => topic.itemIds.length >= 2);
        const lessons = pending.reduce((sum, topic) => sum + topic.lessons, 0);

        if (latest && lessons > largest) {
          largest = lessons;
          itemId = latest.itemIds[0];
        }
      }
    }
  }

  return {
    itemId: history.size < limit ? (itemId ?? null) : null,
    startedPast: answers.length <= MAX_ANSWERS ? startedPast : new Set<string>(),
  };
}
