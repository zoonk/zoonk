import { joinOptionSkills } from "./option-skills";
import { type PlanGraph } from "./plan-state";

export function followNoticeGraph({
  askedExtras = [],
  current,
  droppedIds = new Set<string>(),
  graph,
}: {
  askedExtras?: readonly string[];
  current: PlanGraph;
  droppedIds?: ReadonlySet<string>;
  graph: PlanGraph;
}): PlanGraph {
  const reading = joinOptionSkills(graph);
  const noticeIds = new Set(reading.skills.map((skill) => skill.skillId));
  const prior = joinOptionSkills(current).skills;

  const skills = [...reading.skills];

  prior.forEach((skill, index) => {
    if (skill.extra || noticeIds.has(skill.skillId) || droppedIds.has(skill.skillId)) {
      return;
    }

    const next = prior.slice(index + 1).find((later) => noticeIds.has(later.skillId));
    const at = next ? skills.findIndex((item) => item.skillId === next.skillId) : -1;
    const kept = { ...skill, phase: Math.min(skill.phase, Math.max(0, graph.phases.length - 1)) };

    if (at === -1) {
      skills.push(kept);
    } else {
      skills.splice(at, 0, kept);
    }
  });

  const asked = new Set(askedExtras);
  const priorExtras = current.extraSkills;
  const readingExtras = new Set(reading.extraSkills?.map((skill) => skill.skillId));

  const extraSkills = reading.extraSkills
    ? [
        ...reading.extraSkills,
        ...(priorExtras ?? []).filter(
          (skill) => asked.has(skill.skillId) && !readingExtras.has(skill.skillId),
        ),
      ]
    : priorExtras;

  return { ...reading, ...(extraSkills && { extraSkills }), skills };
}
