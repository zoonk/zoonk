import { type ExamOutline, isWrittenTestSubject } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type GoalSkillGraph } from "./save-goal-skills";

type GraphSkill = GoalSkillGraph["skills"][number];
type Uncovered = { subject: string; topic: string };

function isPractice({ skill, subject }: { skill: GraphSkill; subject: string }): boolean {
  return skill.outcome === true && skill.area === subject;
}

/**
 * A written test's topics are its tasks, described with their lines and points: its practice
 * skills teach them, so a task none of them cites joins them rather than becoming a skill titled
 * with the task's line.
 */
export function givePracticeItsTasks({
  graph,
  outline,
  uncovered,
}: {
  graph: GoalSkillGraph;
  outline: ExamOutline;
  uncovered: readonly Uncovered[];
}): { graph: GoalSkillGraph; rest: Uncovered[] } {
  const tasks = uncovered.filter(
    ({ subject, topic }) =>
      outline.subjects.some(
        (item) =>
          item.name === subject && item.writtenTasks?.includes(topic) && isWrittenTestSubject(item),
      ) && graph.skills.some((skill) => isPractice({ skill, subject })),
  );

  if (tasks.length === 0) {
    return { graph, rest: [...uncovered] };
  }

  return {
    graph: {
      ...graph,
      skills: graph.skills.map((skill) => {
        const joined = tasks.filter((task) => isPractice({ skill, subject: task.subject }));

        return joined.length === 0
          ? skill
          : { ...skill, topics: [...skill.topics, ...joined.map((task) => task.topic)] };
      }),
    },
    rest: uncovered.filter((item) => !tasks.includes(item)),
  };
}
