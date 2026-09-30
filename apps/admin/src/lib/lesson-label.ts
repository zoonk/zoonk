/**
 * Kinds of the lessons learners finished before the Library, which the ledger keeps as text on
 * their historical rows (the learning v2 migration copied them).
 */
const historicalLessonKindLabels: Record<string, string> = {
  alphabet: "Alphabet",
  custom: "Custom lesson",
  explanation: "Explanation",
  grammar: "Grammar",
  listening: "Listening",
  practice: "Practice",
  quiz: "Quiz",
  reading: "Reading",
  review: "Review",
  translation: "Translation",
  tutorial: "Tutorial",
  vocabulary: "Vocabulary",
};

/**
 * Kinds the v2 learning ledger writes as text: Library lessons, session practice (`practice`, shared
 * with the historical kinds) and capsule reviews, checkpoints (see `CHECKPOINT_LEDGER_KINDS` and
 * `CAPSULE_LEDGER_KIND` in core), "Practice mistakes" runs, and language pattern drills and
 * speaking mocks.
 */
const ledgerLessonKindLabels: Record<string, string> = {
  boss: "Boss",
  capsule: "Capsule review",
  extraPractice: "Extra practice",
  finalBoss: "Final boss",
  library: "Library lesson",
  mistakePractice: "Mistake practice",
  patternDrill: "Pattern drill",
  speakingMock: "Speaking mock",
  weeklyChallenge: "Weekly challenge",
};

const lessonKindLabelsByText: Partial<Record<string, string>> = {
  ...historicalLessonKindLabels,
  ...ledgerLessonKindLabels,
};

/**
 * Stats read lesson kinds as text from the learning ledger, so every admin page labels them the
 * same way and an unknown kind shows as stored.
 */
export function getAdminLessonKindLabel(kind: string): string {
  return lessonKindLabelsByText[kind] ?? kind;
}
