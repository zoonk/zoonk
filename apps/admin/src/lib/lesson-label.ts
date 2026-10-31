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

/** The ledger stores kinds as text, so an unknown kind shows as stored. */
export function getAdminLessonKindLabel(kind: string): string {
  return lessonKindLabelsByText[kind] ?? kind;
}
