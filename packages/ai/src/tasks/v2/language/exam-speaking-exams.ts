/**
 * The certificates whose speaking paper learners practice task by task on the live call: DELE in
 * Spanish, DELF and DALF in French, the Goethe-Zertifikat in German and Cambridge English. Their
 * formats, criteria and points live in `@zoonk/core` (`language/exam-speaking`); the tasks here
 * write a task's card, draw its photos and grade it from what core passes them.
 */
export const SPEAKING_EXAMS = ["dele", "delf", "goethe", "cambridge"] as const;

export type SpeakingExam = (typeof SPEAKING_EXAMS)[number];

export const SPEAKING_EXAM_LANGUAGES: Readonly<Record<SpeakingExam, string>> = {
  cambridge: "en",
  dele: "es",
  delf: "fr",
  goethe: "de",
};

/**
 * The variety each exam's papers and examiners use, as prompts name the target language. DELE
 * accepts any variety from candidates; its papers are written in Spain's.
 */
export const SPEAKING_EXAM_VARIETIES: Readonly<Record<SpeakingExam, string>> = {
  cambridge: "British English",
  dele: "Español de España",
  delf: "Français",
  goethe: "Deutsch",
};
