import { type BlueprintSection, sectionMinutes, toSectionRules } from "./mock-day-sections";
import { type MockCandidate, type MockSectionPlan } from "./mock-plan";
import { takeQuestions } from "./mock-sets";

function planListeningSection({
  fixedClock,
  pace,
  pool,
  section,
  wanted,
}: {
  fixedClock: boolean;
  pace: number;
  pool: readonly MockCandidate[];
  section: BlueprintSection;
  wanted: number;
}): MockSectionPlan {
  const picked = takeQuestions({ pool, wanted });

  return {
    ...toSectionRules(section),
    essays: [],
    itemIds: picked,
    kind: "listening",
    minutes: sectionMinutes({ pace, picked: fixedClock ? wanted : picked.length, section }),
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

export function planOralSection({
  fixedClock,
  listening,
  pace,
  section,
  wanted,
}: {
  fixedClock: boolean;
  listening: ReadonlyMap<string, readonly MockCandidate[]>;
  pace: number;
  section: BlueprintSection;
  wanted: number;
}): MockSectionPlan | null {
  if (section.kind === "speaking") {
    return planSpeakingSection(section);
  }

  const recordings = section.kind === "listening" ? listening.get(section.name ?? "") : undefined;

  return recordings
    ? planListeningSection({ fixedClock, pace, pool: recordings, section, wanted })
    : null;
}
