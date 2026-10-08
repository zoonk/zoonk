import { toTopicKey } from "./topic-key";

/** A heading the reading found over a subject's topics, and the first topic under it. */
type TopicHeading = { firstTopic: string; name: string };

/** A topic as the reading listed it: its words as the blueprint stores them, and whether it's kept. */
type ReadTopic = { kept: boolean; text: string };

export type TopicGroup = { name: string; topics: string[] };

/** A subject's topics under one heading are the subject itself: it takes two to group them. */
const MIN_GROUPS = 2;

/** Each heading where its first topic is, in the reading's order; one listed out of order is wrong. */
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

/**
 * A subject's topics under the syllabus's own headings (ENEM's Física, Química and Biologia): each
 * heading takes the topics from its first one up to the next heading's, in the reading's order,
 * keeping only the topics the blueprint kept. A heading whose first topic isn't listed is left out,
 * and so is a group left without topics. Topics before the first heading belong to none. Nothing
 * when fewer than two groups remain.
 */
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

/**
 * The heading each of a subject's topics sits under, by the topic's words; empty for a subject
 * without headings (or read before they were).
 */
export function getTopicHeadings(groups: readonly TopicGroup[] = []): Map<string, string> {
  return new Map(
    groups.flatMap((group) => group.topics.map((topic) => [topic, group.name] as const)),
  );
}
