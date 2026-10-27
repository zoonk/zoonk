const lessonKindLabelsByText: Partial<Record<string, string>> = {
  boss: "Boss",
  capsule: "Capsule review",
  examSpeaking: "Exam speaking task",
  extraPractice: "Extra practice",
  finalBoss: "Final boss",
  library: "Library lesson",
  mistakePractice: "Mistake practice",
  patternDrill: "Pattern drill",
  practice: "Practice",
  speakingMock: "Speaking mock",
  weeklyChallenge: "Weekly challenge",
};

/**
 * Stats read lesson kinds as text from the learning ledger, so every admin page labels them the
 * same way and an unknown kind shows as stored.
 */
export function getAdminLessonKindLabel(kind: string): string {
  return lessonKindLabelsByText[kind] ?? kind;
}
