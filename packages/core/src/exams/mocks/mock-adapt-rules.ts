import { type MockResult } from "./mock-contract";

/**
 * A topic needs this many questions, every one right, before the mock vouches for it: guessing
 * three five-option questions right happens less than once in a hundred.
 */
const MIN_ACED_QUESTIONS = 3;

/**
 * Each right answer vouches for at most this many of the topic's lessons, as a chapter's test-out
 * asks one question for every two lessons a pass skips. A topic of more lessons than its answers
 * vouch for stays in the plan.
 */
const LESSONS_PER_ANSWER = 2;

/** An area needs this many questions before the mock can say it went badly. */
const MIN_AREA_QUESTIONS = 5;

/** An area answered right less often than this is offered more of the plan's time. */
const WEAK_AREA_SHARE = 0.6;

type PlanItemSkills = { skillIds: string[]; status: string };

/** The topics the mock answered every question right on, with how many questions each had. */
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

/**
 * The topics the mock showed the learner already knows, by the same evidence a test-out asks:
 * every question on them right, at least three, and no more of the plan's lessons on each than
 * its answers vouch for (two per answer). One lucky guess, or two answers for a topic of twenty
 * lessons, never skips anything.
 */
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

/**
 * The plan's items still to do that teach only topics the mock showed the learner knows: the ones
 * a test-out would skip (see `markPlanItemsTestedOut`).
 */
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

/**
 * The area the mock showed needs the most help, to offer it more of the plan's time: the one
 * answered right least often, below 60% over at least five questions, among the plan's areas, when
 * the mock measured others to compare it with, the plan has others to take time from, and it
 * isn't focused already.
 */
export function findWeakestArea({
  focusAreas,
  planAreas,
  result,
}: {
  focusAreas: readonly string[];
  planAreas: readonly string[];
  result: Pick<MockResult, "areas">;
}): MockResult["areas"][number] | null {
  // One area measured (a subject's mock) says nothing about how it compares with the others.
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
