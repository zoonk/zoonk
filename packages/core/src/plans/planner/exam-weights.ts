import { type TopicLevel } from "../../library/exams/topic-frequency";
import { weighGraphByAreaShares } from "./area-shares";
import { type CourseWeights, weighGraphByCourse } from "./course-weights";
import { type PlanGraph } from "./plan-state";
import { weighGraphByTopicFrequency } from "./topic-weights";

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
