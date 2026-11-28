type SizedSkill = {
  area: string | null;
  estimatedLessons: number;
  legacyEstimate?: boolean;
  topics?: readonly string[];
};

function getMedian(values: readonly number[]): number | null {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length === 0) {
    return null;
  }

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function lessonsPerTopic(skill: SizedSkill): number {
  return skill.estimatedLessons / Math.max(1, skill.topics?.length ?? 0);
}

export function estimateTopicLessons(skills: readonly SizedSkill[]) {
  const sized = skills.filter((skill) => !skill.legacyEstimate);
  const overall = getMedian(sized.map((skill) => lessonsPerTopic(skill)));

  const subjects = new Map(
    [...Map.groupBy(sized, (skill) => skill.area)].map(([area, items]) => [
      area,
      getMedian(items.map((skill) => lessonsPerTopic(skill))),
    ]),
  );

  return function forSubject(subject: string | null): number | null {
    const median = subjects.get(subject) ?? overall;
    return median === null ? null : Math.max(1, Math.round(median));
  };
}

const TOPIC_ENUMERATOR = /^\s*(?:\d+(?:\.\d+)*[.)]?|[a-z][.)]|[ivxlc]+\s*[.)–-])\s+/iu;

const TOPIC_EXAMPLES =
  /\s*\((?:e\.\s?g\.|i\.\s?e\.|ex\.|p\.\s?ex\.|p\.\s?ej\.|z\.\s?b\.|por exemplo|por ejemplo|par exemple|for example|such as|como)[^)]*\)/giu;

/** "A. Thermodynamic laws (e.g., entropy)" names its skill "Thermodynamic laws". */
export function toTopicSkillName(topic: string): string {
  const name = topic.replace(TOPIC_ENUMERATOR, "").replaceAll(TOPIC_EXAMPLES, "").trim();
  return name || topic.trim();
}
