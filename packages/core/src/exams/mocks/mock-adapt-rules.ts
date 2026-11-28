import { fallsShort } from "../scoring/mock-points";
import { type MockResult } from "./mock-contract";

/** Guessing three five-option answers correctly has less than a 1% chance. */
const MIN_ACED_QUESTIONS = 3;

/** Matches the chapter test-out requirement of one answer per two skipped lessons. */
const LESSONS_PER_ANSWER = 2;

const MIN_PART_QUESTIONS = 5;

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

/** A verdict covers the whole test; a projection needs as many of its questions as a subject does. */
export function listShortParts({
  areas,
  points,
}: Pick<MockResult, "areas" | "points">): Set<string> {
  const questions = (part: string) =>
    areas.reduce((sum, area) => (area.part === part ? sum + area.total : sum), 0);

  return new Set(
    points?.parts.flatMap((part) =>
      fallsShort(part) && (part.met !== null || questions(part.name) >= MIN_PART_QUESTIONS)
        ? [part.name]
        : [],
    ),
  );
}
