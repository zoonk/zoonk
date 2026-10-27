/**
 * The certificates whose speaking paper learners practice task by task on the live call: DELE in
 * Spanish, DELF and DALF in French, the Goethe-Zertifikat in German and Cambridge English. Their
 * formats, criteria and points live in `@zoonk/core` (`language/exam-speaking`); the tasks here
 * write a task's card, draw its photos and grade it from what core passes them.
 */
export const SPEAKING_EXAMS = ["dele", "delf", "goethe", "cambridge"] as const;

export type SpeakingExam = (typeof SPEAKING_EXAMS)[number];

/**
 * The exams whose whole speaking test a live call runs as one shorter mock, both in English: IELTS
 * Speaking (three parts) and TOEFL iBT Speaking (Listen and Repeat, then Take an Interview). Core
 * keeps their criteria and scales (`language/conversations/speaking-mock-format`).
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
 * The variety each exam's papers and examiners use, as prompts name the target language. DELE
 * accepts any variety from candidates; its papers are written in Spain's. IELTS and TOEFL accept any
 * variety, and the app's English is US English.
 */
export const SPEAKING_EXAM_VARIETIES: Readonly<Record<SpeakingExam | SpeakingMockExam, string>> = {
  cambridge: "British English",
  dele: "Español de España",
  delf: "Français",
  goethe: "Deutsch",
  ielts: "US English",
  toefl: "US English",
};
