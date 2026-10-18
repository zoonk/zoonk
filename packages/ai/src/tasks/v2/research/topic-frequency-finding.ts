const MAX_TITLE_LENGTH = 200;
const MAX_BASIS_LENGTH = 120;

export const TOPIC_FREQUENCY_LEVELS = ["high", "medium", "low"] as const;

type Level = (typeof TOPIC_FREQUENCY_LEVELS)[number];

/** A subject as the lookup is asked about it: its name and its topics, in the notice's words. */
export type TopicFrequencySubject = { name: string; topics: string[] };

/** The lookup's answer as the model gave it: subjects by number, topics by id ("S2.5"). */
export type RawTopicFrequencyFinding = {
  subjects: {
    basis: string;
    sourceTitle: string | null;
    sourceUrl: string | null;
    subject: number;
    topics: { appearances: number | null; level: string; topic: string }[];
  }[];
};

/** What one source says about how often a subject's topics are asked, in the notice's words. */
export type TopicFrequencyFinding = {
  subjects: {
    basis: string;
    name: string;
    source: { title: string | null; url: string };
    topics: { appearances: number | null; level: Level; topic: string }[];
  }[];
};

const TOPIC_ID_PATTERN = /^S(?<subject>\d+)\.(?<topic>\d+)$/u;

function isLevel(value: string): value is Level {
  return TOPIC_FREQUENCY_LEVELS.some((level) => level === value);
}

function toAppearances(value: number | null): number | null {
  return value !== null && Number.isInteger(value) && value >= 0 ? value : null;
}

/** The subject's own topic an id names ("S2.5" in subject 2), or null for another subject's. */
function findTopic({
  id,
  number,
  subject,
}: {
  id: string;
  number: number;
  subject: TopicFrequencySubject;
}): string | null {
  const match = TOPIC_ID_PATTERN.exec(id.trim())?.groups;

  if (!match || Number(match.subject) !== number) {
    return null;
  }

  return subject.topics[Number(match.topic) - 1] ?? null;
}

/** The topics a source rates, each once, in the notice's words. */
function toTopics({
  entry,
  subject,
}: {
  entry: RawTopicFrequencyFinding["subjects"][number];
  subject: TopicFrequencySubject;
}): TopicFrequencyFinding["subjects"][number]["topics"] {
  const rated = entry.topics.flatMap(({ appearances, level, topic: id }) => {
    const topic = findTopic({ id, number: entry.subject, subject });

    return topic && isLevel(level)
      ? [{ appearances: toAppearances(appearances), level, topic }]
      : [];
  });

  return rated.filter(
    (item, index) => rated.findIndex((other) => other.topic === item.topic) === index,
  );
}

/**
 * Keeps only what a plan can rank topics by: for each subject asked about, once, the topics of
 * its own that one source rates, from a page a search actually returned. Anything else is left
 * out, never guessed.
 */
export function toTopicFrequencyFinding({
  isSearched,
  raw,
  subjects,
}: {
  /** Whether an address is on a site the search returned; anything else was invented. */
  isSearched: (url: string) => boolean;
  raw: RawTopicFrequencyFinding;
  subjects: readonly TopicFrequencySubject[];
}): TopicFrequencyFinding {
  const found = raw.subjects.flatMap((entry) => {
    const subject = subjects[entry.subject - 1];
    const url = entry.sourceUrl?.trim();

    if (!subject || !url || !URL.canParse(url) || !isSearched(url)) {
      return [];
    }

    const topics = toTopics({ entry, subject });

    return topics.length > 0
      ? [
          {
            basis: entry.basis.trim().slice(0, MAX_BASIS_LENGTH),
            name: subject.name,
            source: { title: entry.sourceTitle?.trim().slice(0, MAX_TITLE_LENGTH) || null, url },
            topics,
          },
        ]
      : [];
  });

  return {
    subjects: found.filter(
      (entry, index) => found.findIndex((other) => other.name === entry.name) === index,
    ),
  };
}
