import { type TopicLevel } from "../../library/exams/topic-frequency";
import { weighGraphByAreaShares } from "./area-shares";
import { type CourseWeights, weighGraphByCourse } from "./course-weights";
import { type PlanGraph } from "./plan-state";
import { weighGraphByTopicFrequency } from "./topic-weights";

/**
 * The graph with each skill weighed by what the exam asks of it: its part's share of the exam
 * (`areaShares`), the learner's course's weights on the parts (SISU's), and how often the exam
 * asks the topics it teaches (`topicLevels`). The planner shares its time by these weights and
 * preparation counts each skill by them, so both read the exam the same way. The stored graph
 * never changes.
 */
export function weighGraphForExam({
  areaShares,
  courseWeights,
  graph,
  topicLevels,
}: {
  areaShares: ReadonlyMap<string, number> | null;
  courseWeights: CourseWeights | null;
  graph: PlanGraph;
  topicLevels: readonly TopicLevel[];
}): PlanGraph {
  return weighGraphByTopicFrequency({
    graph: weighGraphByCourse({
      graph: weighGraphByAreaShares({ graph, shares: areaShares }),
      weights: courseWeights,
    }),
    levels: topicLevels,
  });
}
