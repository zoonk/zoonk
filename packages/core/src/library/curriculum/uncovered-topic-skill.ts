import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];

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

function getLessonsPerTopic(skills: readonly GraphSkill[]): number | null {
  return getMedian(
    skills.map((skill) => skill.estimatedLessons / Math.max(1, skill.topics.length)),
  );
}

/** A topic no skill teaches is sized like the skills the writer sized in its subject. */
export function getTopicLessons({
  sized,
  subject,
}: {
  sized: GoalSkillGraph;
  subject: string;
}): number {
  const median =
    getLessonsPerTopic(sized.skills.filter((skill) => skill.area === subject)) ??
    getLessonsPerTopic(sized.skills) ??
    1;

  return Math.max(1, Math.round(median));
}

const TOPIC_ENUMERATOR = /^\s*(?:\d+(?:\.\d+)*[.)]?|[a-z][.)]|[ivxlc]+\s*[.)–-])\s+/iu;

const TOPIC_EXAMPLES =
  /\s*\((?:e\.\s?g\.|i\.\s?e\.|ex\.|p\.\s?ex\.|p\.\s?ej\.|z\.\s?b\.|por exemplo|por ejemplo|par exemple|for example|such as|como)[^)]*\)/giu;

/** "A. Thermodynamic laws (e.g., entropy)" names its skill "Thermodynamic laws". */
export function toTopicSkillName(topic: string): string {
  const name = topic.replace(TOPIC_ENUMERATOR, "").replaceAll(TOPIC_EXAMPLES, "").trim();
  return name || topic.trim();
}
