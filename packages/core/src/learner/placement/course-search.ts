import  { type OwnLevel } from "./placement-steps";

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
  multipleAreas: boolean,
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

  if (multipleAreas && itemId === confirm && right.length === 1 && low >= 3) {
    const supporting = probes.findLast(
      (probe) => probe.index < low && probe.itemIds.length >= 2 && probe.answers.length === 0,
    );

    itemId = supporting?.itemIds[0] ?? itemId;
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
  const history = new Map(answers.map(({ itemId, correct }) => [itemId, correct]));
  const remaining = Math.min(MAX_ANSWERS, ceiling) - history.size;
  const groups = Map.groupBy(topics, (topic) => topic.sectionTitle);

  const bySize = [...groups.values()]
    .map((area) => ({ area, lessons: area.reduce((sum, topic) => sum + topic.lessons, 0) }))
    .toSorted((a, b) => b.lessons - a.lessons)
    .slice(0, 3);

  const startedPast = new Set<string>();
  const last = topics.at(-1);

  const states = bySize.map(({ area }) => {
    const state = searchArea(area, history, position, remaining, bySize.length > 1);

    if (answers.length <= MAX_ANSWERS) {
      for (const topic of area.slice(0, state.boundary + 1)) {
        if (topic.askable && topic !== last) {
          startedPast.add(topic.id);
        }
      }
    }

    return state;
  });

  const next = states.filter((state) => state.itemId).toSorted((a, b) => a.answers - b.answers)[0];
  return { itemId: remaining > 0 ? (next?.itemId ?? null) : null, startedPast };
}
