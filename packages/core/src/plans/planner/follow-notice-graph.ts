import { joinOptionSkills } from "./option-skills";
import { type PlanGraph, type PlanState } from "./plan-state";

export function followNoticeGraph({
  droppedIds = new Set<string>(),
  graph,
  state,
}: {
  droppedIds?: ReadonlySet<string>;
  graph: PlanGraph;
  state: PlanState;
}): PlanState {
  const reading = joinOptionSkills(graph);
  const noticeIds = new Set(reading.skills.map((skill) => skill.skillId));
  const current = joinOptionSkills(state.graph).skills;

  const skills = current.reduce((list, skill, index) => {
    if (skill.extra || noticeIds.has(skill.skillId) || droppedIds.has(skill.skillId)) {
      return list;
    }

    const next = current.slice(index + 1).find((later) => noticeIds.has(later.skillId));
    const at = next ? list.findIndex((item) => item.skillId === next.skillId) : -1;
    const kept = { ...skill, phase: Math.min(skill.phase, Math.max(0, graph.phases.length - 1)) };

    return at === -1 ? [...list, kept] : [...list.slice(0, at), kept, ...list.slice(at)];
  }, reading.skills);

  const asked = new Set(state.settings.extras);
  const priorExtras = state.graph.extraSkills;
  const readingExtras = new Set(reading.extraSkills?.map((skill) => skill.skillId));

  const extraSkills = reading.extraSkills
    ? [
        ...reading.extraSkills,
        ...(priorExtras ?? []).filter(
          (skill) => asked.has(skill.skillId) && !readingExtras.has(skill.skillId),
        ),
      ]
    : priorExtras;

  return { ...state, graph: { ...reading, ...(extraSkills && { extraSkills }), skills } };
}
