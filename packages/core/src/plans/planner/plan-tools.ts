import { getToolKey } from "../../library/chapters/chapter-tools";
import { type PlanState, type PlanToolChoice } from "./plan-state";

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
