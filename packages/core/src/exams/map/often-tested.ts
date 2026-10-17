import { type TopicFrequency } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";

/** The skill graph weighs a skill 4 or 5 when a large share of the exam's points depend on it. */
const OFTEN_TESTED_WEIGHT = 4;

type GraphSkill = { name: string; skillId: string; weight: number | null };

/**
 * The goal's skills the board asks a lot ("often tested" on session tiles): skills whose name is
 * a topic past papers ask a lot, or that the skill graph weighed heavily from that same frequency.
 * Without past-paper frequency for the exam, nothing is tagged: the tag is only said with evidence.
 */
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
