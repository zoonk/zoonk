import { type TopicFrequency } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";

const OFTEN_TESTED_WEIGHT = 4;

type GraphSkill = { name: string; skillId: string; weight: number | null };

export function getOftenTestedSkillIds({
  frequency,
  skills,
}: {
  frequency: TopicFrequency;
  skills: readonly GraphSkill[];
}): Set<string> {
  const frequentTopics = frequency.filter((entry) => entry.level === "high");

  if (frequentTopics.length === 0) {
    return new Set();
  }

  return new Set(
    skills
      .filter(
        (skill) =>
          (skill.weight ?? 0) >= OFTEN_TESTED_WEIGHT ||
          frequentTopics.some((topic) => namesMatch(topic.topic, skill.name)),
      )
      .map((skill) => skill.skillId),
  );
}
