import { type BlueprintSection, sectionMinutes, toSectionRules } from "./mock-day-sections";
import { type MockCandidate, type MockSectionPlan } from "./mock-plan";

export function planListeningSection({
  pace,
  pool,
  section,
  wanted,
}: {
  pace: number;
  pool: readonly MockCandidate[];
  section: BlueprintSection;
  wanted: number;
}): MockSectionPlan {
  const picked = pool.slice(0, wanted).map((question) => question.itemId);

  return {
    ...toSectionRules(section),
    essays: [],
    itemIds: picked,
    kind: "listening",
    minutes: sectionMinutes({ pace, picked: picked.length, section }),
    name: section.name,
    questions: picked.length,
    routing: null,
  };
}

const DEFAULT_SPEAKING_MINUTES = 15;

export function planSpeakingSection(section: BlueprintSection): MockSectionPlan {
  return {
    ...toSectionRules(section),
    essays: [],
    itemIds: [],
    kind: "speaking",
    minutes: section.minutes ?? DEFAULT_SPEAKING_MINUTES,
    name: section.name,
    questions: 0,
    routing: null,
  };
}
