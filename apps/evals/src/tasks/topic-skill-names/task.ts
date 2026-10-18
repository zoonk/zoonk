import { type Task } from "@/lib/types";
import {
  type TopicSkillName,
  type TopicSkillNamesInput,
  nameTopicSkills,
} from "@zoonk/ai/tasks/v2/plans/topic-skill-names";
import { type TopicSkillNamesExpected, scoreTopicSkillNames } from "./scorer";
import { TEST_CASES } from "./test-cases";

/**
 * Scored by what reaches the shared Library: no detail of the learner's (their teacher, school,
 * company, test or dates) in any skill, and each skill still naming what it teaches.
 */
export const topicSkillNamesTask: Task<
  TopicSkillNamesInput,
  (TopicSkillName | null)[],
  TopicSkillNamesExpected
> = {
  description:
    "Name the topics a learner adds to their plan as shared Library skills, with no personal details",
  generate: nameTopicSkills,
  id: "topic-skill-names",
  latencyBudget: { p50: 3, p95: 6 },
  name: "Topic Skill Names",
  score: scoreTopicSkillNames,
  testCases: TEST_CASES,
};
