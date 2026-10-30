/** Practiced task by task; formats, criteria and points live in core's `language/exam-speaking`. */
export const SPEAKING_EXAMS = ["dele", "delf", "goethe", "cambridge"] as const;

export type SpeakingExam = (typeof SPEAKING_EXAMS)[number];

/**
 * Run as one shorter mock of the whole test; core keeps their criteria and scales
 * (`language/conversations/speaking-mock-format`).
 */
export const SPEAKING_MOCK_EXAMS = ["ielts", "toefl"] as const;

export type SpeakingMockExam = (typeof SPEAKING_MOCK_EXAMS)[number];

export const SPEAKING_EXAM_LANGUAGES: Readonly<Record<SpeakingExam, string>> = {
  cambridge: "en",
  dele: "es",
  delf: "fr",
  goethe: "de",
};

/**
 * DELE accepts any variety from candidates but writes its papers in Spain's; IELTS and TOEFL accept
 * any, and the app's English is US English.
 */
export const SPEAKING_EXAM_VARIETIES: Readonly<Record<SpeakingExam | SpeakingMockExam, string>> = {
  cambridge: "British English",
  dele: "Español de España",
  delf: "Français",
  goethe: "Deutsch",
  ielts: "US English",
  toefl: "US English",
};
