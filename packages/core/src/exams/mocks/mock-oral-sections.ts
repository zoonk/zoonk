import { type BlueprintSection, sectionMinutes, toSectionRules } from "./mock-day-sections";
import { type MockCandidate, type MockSectionPlan } from "./mock-plan";
import { takeQuestions } from "./mock-sets";

/**
 * A listening section as a mock sits it: the recordings it plays (`pool`, whole sets in the
 * parts' order, see `loadListeningCandidates`), as many as its share of questions holds, each with
 * every one of its questions, on the notice's clock for them.
 */
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
  const picked = takeQuestions({ pool, wanted });

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

/** A speaking section the notice gives no time for: about a paper's four tasks. */
const DEFAULT_SPEAKING_MINUTES = 15;

/**
 * A speaking section as a full mock sits it: the exam's speaking paper, each task a live call
 * with the examiner, started when the learner reaches it (`startMockSpeaking`), on the notice's
 * clock for the section. It asks no written questions.
 */
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
