import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type TopicSkillName } from "@zoonk/ai/tasks/v2/plans/topic-skill-names";
import { normalizeString } from "@zoonk/utils/string";

export type TopicSkillNamesExpected = { topics: { general: string[]; personal: string[] }[] };

const MAX_NAME_LENGTH = 80;

function includesText(haystack: string, needle: string): boolean {
  return normalizeString(haystack).includes(normalizeString(needle));
}

function parseSkills(output: string): (TopicSkillName | null)[] {
  try {
    const parsed: unknown = JSON.parse(output);
    return Array.isArray(parsed) ? (parsed as (TopicSkillName | null)[]) : [];
  } catch {
    return [];
  }
}

function listProblems({
  expected,
  skill,
}: {
  expected: TopicSkillNamesExpected["topics"][number];
  skill: TopicSkillName | null | undefined;
}): { leaks: string[]; misses: string[] } {
  if (!skill) {
    return { leaks: [], misses: ["no skill"] };
  }

  const text = `${skill.name} ${skill.description}`;

  return {
    leaks: expected.personal
      .filter((detail) => includesText(text, detail))
      .map((detail) => `"${detail}" leaked into "${skill.name}"`),
    misses: [
      expected.general.length > 0 &&
        !expected.general.some((keyword) => includesText(skill.name, keyword)) &&
        `"${skill.name}" doesn't name ${expected.general.join(" or ")}`,
      skill.name.length > MAX_NAME_LENGTH && `"${skill.name}" is longer than ${MAX_NAME_LENGTH}`,
    ].filter((problem): problem is string => typeof problem === "string"),
  };
}

export const scoreTopicSkillNames: TaskScorer<TopicSkillNamesExpected> = ({ output, testCase }) => {
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const skills = parseSkills(output);

  const problems = expected.topics.map((topic, index) =>
    listProblems({ expected: topic, skill: skills[index] }),
  );

  const leaks = problems.flatMap((problem) => problem.leaks);
  const misses = problems.flatMap((problem) => problem.misses);

  if (leaks.length > 0) {
    return createFixedScore({ conclusion: [...leaks, ...misses].join(" "), score: 6 });
  }

  if (misses.length > 0) {
    return createFixedScore({ conclusion: misses.join(" "), score: 8 });
  }

  return createFixedScore({ conclusion: "None", score: 10 });
};
