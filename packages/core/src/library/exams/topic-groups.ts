import { toTopicKey } from "./topic-key";

type TopicHeading = { firstTopic: string; name: string };

type ReadTopic = { kept: boolean; text: string };

export type TopicGroup = { name: string; topics: string[] };

const MIN_GROUPS = 2;

function findStarts({
  headings,
  topics,
}: {
  headings: readonly TopicHeading[];
  topics: readonly ReadTopic[];
}): { index: number; name: string }[] {
  const keys = topics.map((topic) => toTopicKey(topic.text));

  const found = headings
    .map((heading) => ({
      index: keys.indexOf(toTopicKey(heading.firstTopic)),
      name: heading.name.trim(),
    }))
    .filter((start) => start.index >= 0 && start.name.length > 0);

  return found.filter((start, position) =>
    found.slice(0, position).every((earlier) => earlier.index < start.index),
  );
}

export function groupTopicsByHeading({
  headings,
  topics,
}: {
  headings: readonly TopicHeading[];
  topics: readonly ReadTopic[];
}): TopicGroup[] {
  const starts = findStarts({ headings, topics });

  const groups = starts
    .map((start, position) => ({
      name: start.name,
      topics: [
        ...new Set(
          topics
            .slice(start.index, starts[position + 1]?.index ?? topics.length)
            .filter((topic) => topic.kept)
            .map((topic) => topic.text),
        ),
      ],
    }))
    .filter((group) => group.topics.length > 0);

  return groups.length >= MIN_GROUPS ? groups : [];
}

export function getTopicHeadings(groups: readonly TopicGroup[] = []): Map<string, string> {
  return new Map(
    groups.flatMap((group) => group.topics.map((topic) => [topic, group.name] as const)),
  );
}
