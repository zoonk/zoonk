import { type Task } from "@/lib/types";
import {
  type TopicSkillName,
  type TopicSkillNamesInput,
  nameTopicSkills,
} from "@zoonk/ai/tasks/plans/topic-skill-names";
import { type TopicSkillNamesExpected, scoreTopicSkillNames } from "./scorer";
import { TEST_CASES } from "./test-cases";

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
  name: "Topic skill names",
  priorities: {
    distribution: "shared",
    first: "latency",
    reads: "Code names new shared skills",
    reason: "The learner waits on it; the cheapest that named skills right",
    waits: "A learner waits on the buddy's card",
  },
  score: scoreTopicSkillNames,
  testCases: TEST_CASES,
};
