import { fallsShort } from "../scoring/mock-points";
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

type AreaResult = MockResult["areas"][number];

/** Mocks graded before areas kept their points have only right answers. */
function getPoints(area: AreaResult): { asked: number; earned: number } {
  return area.points ?? { asked: area.total, earned: area.correct };
}

function share(area: AreaResult): number {
  const { asked, earned } = getPoints(area);
  return asked > 0 ? earned / asked : 0;
}

function lost(area: AreaResult): number {
  const { asked, earned } = getPoints(area);
  return asked - earned;
}

/** A verdict covers the whole test; a projection needs as many of its questions as an area does. */
function listShortParts({ areas, points }: Pick<MockResult, "areas" | "points">): Set<string> {
  const questions = (part: string) =>
    areas.reduce((sum, area) => (area.part === part ? sum + area.total : sum), 0);

  return new Set(
    points?.parts.flatMap((part) =>
      fallsShort(part) && (part.met !== null || questions(part.name) >= MIN_AREA_QUESTIONS)
        ? [part.name]
        : [],
    ),
  );
}

/**
 * A test below its minimum eliminates the learner whatever the total, so time goes to it first:
 * to its subject that lost the most points, and nowhere else while all of them are focused.
 */
export function findWeakestArea({
  focusAreas,
  planAreas,
  result,
}: {
  focusAreas: readonly string[];
  planAreas: readonly string[];
  result: Pick<MockResult, "areas" | "points">;
}): AreaResult | null {
  if (planAreas.length < 2 || result.areas.length < 2) {
    return null;
  }

  const open = (area: AreaResult) =>
    planAreas.includes(area.name) && !focusAreas.includes(area.name);

  const short = listShortParts(result);
  const inShortParts = result.areas.filter((area) => area.part && short.has(area.part));

  if (inShortParts.length > 0) {
    const losing = inShortParts.filter((area) => open(area) && lost(area) > 0);
    return losing.toSorted((first, second) => lost(second) - lost(first))[0] ?? null;
  }

  const weak = result.areas.filter(
    (area) => open(area) && area.total >= MIN_AREA_QUESTIONS && share(area) < WEAK_AREA_SHARE,
  );

  return weak.toSorted((first, second) => share(first) - share(second))[0] ?? null;
}
