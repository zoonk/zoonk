import { type MockConditions } from "../mock-contract";
import { type MockSectionView } from "../mock-view-contract";

/** Includes the easier set of unreached routed modules so early completion still grades those questions as blank. */
export function getAskedItemIds(conditions: MockConditions): { itemId: string; section: number }[] {
  return conditions.sections.flatMap((section, index) => {
    const ids =
      section.itemIds.length > 0 || !section.routing ? section.itemIds : section.routing.easier;

    return ids
      .slice(0, Math.max(section.questions, section.itemIds.length))
      .map((itemId) => ({ itemId, section: index }));
  });
}

export function getEssayItemIds(conditions: MockConditions): string[] {
  return conditions.sections.flatMap((section) => section.essays);
}

export function getFirstNumber({
  conditions,
  section,
}: {
  conditions: MockConditions;
  section: number;
}): number {
  return conditions.sections.slice(0, section).reduce((sum, item) => sum + item.questions, 1);
}

export function toSectionViews({
  conditions,
  current,
  finished,
}: {
  conditions: MockConditions;
  current: number | null;
  finished: boolean;
}): MockSectionView[] {
  return conditions.sections.map((section, index) => ({
    breakAfterMinutes: section.breakAfterMinutes ?? null,
    essays: section.essays.length,
    index,
    minutes: section.minutes,
    name: section.name,
    navigation: section.navigation ?? null,
    questions: section.questions,
    status: getSectionStatus({ current, finished, index }),
    tools: section.tools ?? null,
  }));
}

function getSectionStatus({
  current,
  finished,
  index,
}: {
  current: number | null;
  finished: boolean;
  index: number;
}): MockSectionView["status"] {
  if (finished || (current !== null && index < current)) {
    return "done";
  }

  return current === index ? "current" : "upcoming";
}
