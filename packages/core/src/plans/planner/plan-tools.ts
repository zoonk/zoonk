import { getToolKey } from "../../library/chapters/chapter-tools";
import { type PlanState, type PlanToolChoice } from "./plan-state";

/**
 * Replaces the learner's choices for these tools. A setup lesson a replaced choice added leaves
 * the graph unless the new choice keeps it, so switching devices or saying "I have it" takes the
 * old setup lesson out; lessons already done stay done.
 */
export function setTools({
  state,
  tools,
}: {
  state: PlanState;
  tools: readonly PlanToolChoice[];
}): PlanState {
  const keys = new Set(tools.map((tool) => getToolKey(tool.name)));
  const isReplaced = (tool: PlanToolChoice) => keys.has(getToolKey(tool.name));
  const kept = new Set(tools.flatMap((tool) => tool.setupSkillId ?? []));

  const removed = new Set(
    state.settings.tools
      .filter((tool) => isReplaced(tool))
      .flatMap((tool) => tool.setupSkillId ?? [])
      .filter((skillId) => !kept.has(skillId)),
  );

  return {
    ...state,
    graph: {
      ...state.graph,
      skills: state.graph.skills.filter((skill) => !removed.has(skill.skillId)),
    },
    settings: {
      ...state.settings,
      tools: [...state.settings.tools.filter((tool) => !isReplaced(tool)), ...tools],
    },
  };
}
