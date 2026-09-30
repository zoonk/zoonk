import { type PlanItem } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { countSkillStates } from "../../learner/mastery-state";
import {
  findCurrentPhase,
  findNextItem,
  getProgressState,
} from "../../plans/_utils/plan-phase-views";
import { type MapArea, type MapPhase, type MapSkill } from "../map/map-contract";

/** Lessons and chapters are what a plan teaches; checkpoints and reviews come around them. */
const LEARN_KINDS = new Set<PlanItem["kind"]>(["chapter", "lesson"]);

export type MapItem = Pick<
  PlanItem,
  "chapterId" | "id" | "kind" | "lessonId" | "phase" | "status"
> & { skillIds: string[] };

export type MapNode = { areaId: string; phase: number; skill: MapSkill; title: string };

type AreaDetails = { courseId: string | null; title: string };

function getPhaseAreaId(phase: number) {
  return `phase:${phase}`;
}

/** An item's area: where its first skill sits, else its chapter, else its phase. */
function getItemArea({ item, nodes }: { item: MapItem; nodes: ReadonlyMap<string, MapNode> }) {
  const skillArea = item.skillIds.map((skillId) => nodes.get(skillId)?.areaId).find(Boolean);
  return skillArea ?? item.chapterId ?? getPhaseAreaId(item.phase);
}

function getAreaState({
  areaId,
  currentAreaId,
  items,
}: {
  areaId: string;
  currentAreaId: string | null;
  items: readonly (MapItem & { areaId: string })[];
}): MapArea["state"] {
  if (areaId === currentAreaId) {
    return "current";
  }

  const inArea = items.filter((item) => item.areaId === areaId);
  const isDone = inArea.length > 0 && inArea.every((item) => item.status !== "todo");

  return isDone ? "done" : "upcoming";
}

/**
 * Groups a goal's skills into areas in plan order: each chapter (or a phase's skills before its
 * chapters exist) with its state and whether the learner is there now, then the phases with their
 * state and counts. A chapter with no skills yet still shows, so the map never hides a chapter.
 * The current phase is the plan's (see `findCurrentPhase`), and the learner is in the area of the
 * next lesson in that phase.
 */
export function buildGoalMapAreas({
  areaDetails,
  items,
  nodes,
  phaseNames,
}: {
  areaDetails: ReadonlyMap<string, AreaDetails>;
  items: readonly MapItem[];
  nodes: readonly MapNode[];
  phaseNames: readonly string[];
}): { areas: MapArea[]; phases: MapPhase[] } {
  const nodesBySkill = new Map(nodes.map((node) => [node.skill.skillId, node]));

  const learnItems = items
    .filter((item) => LEARN_KINDS.has(item.kind))
    .map((item) => ({ ...item, areaId: getItemArea({ item, nodes: nodesBySkill }) }));

  const areaIds = [
    ...new Set([...learnItems.map((item) => item.areaId), ...nodes.map((node) => node.areaId)]),
  ];

  const grouped = areaIds.map((areaId) => {
    const skills = nodes.filter((node) => node.areaId === areaId);
    const firstItem = learnItems.find((item) => item.areaId === areaId);

    return { areaId, phase: firstItem?.phase ?? skills[0]?.phase ?? 0, skills };
  });

  const phaseCount = Math.max(phaseNames.length, ...grouped.map((area) => area.phase + 1));
  const currentPhase = findCurrentPhase({ items, phaseCount });

  const currentAreaId =
    findNextItem(learnItems.filter((item) => item.phase === currentPhase))?.areaId ?? null;

  const areas = grouped.map(({ areaId, phase, skills }): MapArea => {
    const details = areaDetails.get(areaId);

    return {
      areaId,
      chapterId: isUuid(areaId) ? areaId : null,
      counts: countSkillStates(skills.map((node) => node.skill)),
      courseId: details?.courseId ?? null,
      current: areaId === currentAreaId,
      phase,
      skills: skills.map((node) => node.skill),
      state: getAreaState({ areaId, currentAreaId, items: learnItems }),
      title: details?.title || skills[0]?.title || phaseNames[phase] || "",
    };
  });

  const phases = Array.from({ length: phaseCount }, (_, index) => ({
    counts: countSkillStates(
      areas.filter((area) => area.phase === index).flatMap((area) => area.skills),
    ),
    index,
    name: phaseNames[index] ?? "",
    state: getProgressState({ current: currentPhase, index }),
  }));

  return { areas, phases };
}
