import { type ExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type PlannedSkillGraph } from "./goal-plan-graph";
import { findOutsideNoticeSkills } from "./prune-notice-skills";

export function pruneGoalNoticeGraph({
  graph,
  outline,
}: {
  graph: PlannedSkillGraph;
  outline?: ExamOutline;
}): { graph: PlannedSkillGraph; droppedKeys: string[] } {
  if (!outline) {
    return { droppedKeys: [], graph };
  }

  const droppedKeys = findOutsideNoticeSkills({
    skills: graph.skills.map((skill) => ({
      ...skill,
      id: skill.key,
      topics: skill.topicsUnknown && skill.topics.length === 0 ? undefined : skill.topics,
    })),
    subjects: outline.subjects,
  });

  if (droppedKeys.length === 0) {
    return { droppedKeys, graph };
  }

  const dropped = new Set(droppedKeys);
  const skills = graph.skills.filter((skill) => !dropped.has(skill.key));
  const courses = new Set([...skills, ...(graph.extraSkills ?? [])].map((skill) => skill.course));

  return {
    droppedKeys,
    graph: { ...graph, courses: graph.courses.filter((course) => courses.has(course.key)), skills },
  };
}
