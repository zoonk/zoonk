import { type MockResult } from "./mock-contract";

/** Guessing three five-option answers correctly has less than a 1% chance. */
const MIN_ACED_QUESTIONS = 3;

/** Matches the chapter test-out requirement of one answer per two skipped lessons. */
const LESSONS_PER_ANSWER = 2;

const MIN_AREA_QUESTIONS = 5;

const WEAK_AREA_SHARE = 0.6;

type PlanItemSkills = { skillIds: string[]; status: string };

function getAcedTopics(result: Pick<MockResult, "topics">): Map<string, number> {
  return new Map(
    result.topics
      .filter((topic) => topic.total >= MIN_ACED_QUESTIONS && topic.correct === topic.total)
      .map((topic) => [topic.skillId, topic.total]),
  );
}

function isTodoTeaching(item: PlanItemSkills, skillId: string): boolean {
  return item.status === "todo" && item.skillIds.includes(skillId);
}

export function getAcedSkillIds({
  items,
  result,
}: {
  items: readonly PlanItemSkills[];
  result: Pick<MockResult, "topics">;
}): Set<string> {
  const aced = getAcedTopics(result);

  return new Set(
    [...aced].flatMap(([skillId, answers]) => {
      const lessons = items.filter((item) => isTodoTeaching(item, skillId)).length;
      return lessons <= answers * LESSONS_PER_ANSWER ? [skillId] : [];
    }),
  );
}

export function findSkippableItems<TItem extends PlanItemSkills>({
  aced,
  items,
}: {
  aced: ReadonlySet<string>;
  items: readonly TItem[];
}): TItem[] {
  return items.filter(
    (item) =>
      item.status === "todo" &&
      item.skillIds.length > 0 &&
      item.skillIds.every((skillId) => aced.has(skillId)),
  );
}

function share(area: Pick<MockResult["areas"][number], "correct" | "total">): number {
  return area.total > 0 ? area.correct / area.total : 0;
}

export function findWeakestArea({
  focusAreas,
  planAreas,
  result,
}: {
  focusAreas: readonly string[];
  planAreas: readonly string[];
  result: Pick<MockResult, "areas">;
}): MockResult["areas"][number] | null {
  if (planAreas.length < 2 || result.areas.length < 2) {
    return null;
  }

  const weak = result.areas.filter(
    (area) =>
      area.total >= MIN_AREA_QUESTIONS &&
      share(area) < WEAK_AREA_SHARE &&
      planAreas.includes(area.name) &&
      !focusAreas.includes(area.name),
  );

  return weak.toSorted((first, second) => share(first) - share(second))[0] ?? null;
}
