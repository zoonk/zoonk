import { getSkillArea } from "../../plans/planner/graph-areas";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { MIN_BLOCK_MINUTES, PRACTICE_MINUTES_PER_QUESTION, toMinutes } from "../block-minutes";
import { type BlockDrill, toBlockPayload } from "../block-payload";
import { isFullReview } from "../full-review";
import { type PlannedBlock, type PracticeItem } from "../session-builder";
import { splitPracticeQuestions, takePracticeQuestions } from "./practice-sets";

const MAX_PRACTICE_BLOCK_MINUTES = 15;

export function countDrilled(drills: readonly BlockDrill[]): number {
  return drills.reduce((sum, drill) => sum + drill.itemIds.length, 0);
}

export type PracticeTopic = { area: string; name: string };

export function getPlanTopics(graph: PlanGraph): Map<string, PracticeTopic> {
  return new Map(
    graph.skills.map((skill) => [
      skill.skillId,
      { area: getSkillArea({ graph, skill }), name: skill.name },
    ]),
  );
}

function byCount(names: readonly string[]): [string, number][] {
  const counts = Map.groupBy(names, (name) => name);

  return [...counts]
    .map(([name, list]): [string, number] => [name, list.length])
    .toSorted(([, a], [, b]) => b - a);
}

/** A second area names the block only when it has at least half as many questions as the first. */
export function getPracticeLabels({
  items,
  topics,
}: {
  items: readonly Pick<PracticeItem, "skillId">[];
  topics: ReadonlyMap<string, PracticeTopic>;
}): { areas: string[]; topics: string[] } {
  const known = items.flatMap((item) => topics.get(item.skillId) ?? []);
  const areas = byCount(known.map((topic) => topic.area).filter(Boolean));
  const most = areas[0]?.[1] ?? 0;

  return {
    areas: areas.slice(0, 2).flatMap(([area, count]) => (count * 2 >= most ? [area] : [])),
    topics: byCount(known.map((topic) => topic.name)).map(([name]) => name),
  };
}

/** An even number of questions per part, so every part but the last takes whole minutes. */
function getPracticePartSize(questions: number): number {
  const parts = Math.ceil((questions * PRACTICE_MINUTES_PER_QUESTION) / MAX_PRACTICE_BLOCK_MINUTES);
  return 2 * Math.ceil(questions / (2 * parts));
}

/** A full review stays one block, so it reaches every topic in one sitting like the mock it stands for. */
export function buildPracticeBlocks({
  drills,
  fullReviewSkillIds,
  minutes,
  netScored,
  planItemId,
  planItemKey,
  practice,
  reviewedSkillIds,
  topics,
}: {
  drills: readonly BlockDrill[];
  fullReviewSkillIds: readonly string[] | null | undefined;
  minutes: number;
  netScored: boolean;
  planItemId: string | null;
  planItemKey: string | null | undefined;
  practice: readonly PracticeItem[];
  /** Count quick-review skills toward full coverage, including skills whose last unseen questions they used. */
  reviewedSkillIds: readonly string[];
  topics: ReadonlyMap<string, PracticeTopic>;
}): PlannedBlock[] {
  const drillItems = countDrilled(drills);
  const room = Math.floor(minutes / PRACTICE_MINUTES_PER_QUESTION) - drillItems;
  const items = takePracticeQuestions({ practice, room: Math.max(0, room) });
  const questions = drillItems + items.length;

  if (
    questions === 0 ||
    (drills.length === 0 && questions * PRACTICE_MINUTES_PER_QUESTION < MIN_BLOCK_MINUTES)
  ) {
    return [];
  }

  const fullReview = isFullReview({
    fullReviewSkillIds,
    skillIds: [...items.map((item) => item.skillId), ...reviewedSkillIds],
  });

  const parts = fullReview
    ? [items]
    : splitPracticeQuestions({
        first: drillItems,
        practice: items,
        size: getPracticePartSize(questions),
      });

  return parts.map((part, index) => {
    const partDrills = index === 0 ? drills : [];

    return {
      canDo: null,
      estimatedMinutes: toMinutes(
        (countDrilled(partDrills) + part.length) * PRACTICE_MINUTES_PER_QUESTION,
      ),
      kind: "practice",
      lessonId: null,
      payload: toBlockPayload({
        drills: [...partDrills],
        fullReview,
        itemIds: part.map((item) => item.itemId),
        netScored,
        planItemId,
        planItemKey: planItemKey ?? null,
        skillIds: [...new Set(part.map((item) => item.skillId))],
        ...getPracticeLabels({ items: part, topics }),
      }),
    };
  });
}
