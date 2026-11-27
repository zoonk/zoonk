import questions from "./saf-answers.json";
import { type WritingCase, basis } from "./shared";

export const SAF_SOURCE =
  "https://huggingface.co/datasets/Short-Answer-Feedback/saf_legal_domain_german";

export const SAF_CASES: WritingCase[] = questions.flatMap(({ answers, id, points, question }) => {
  const criterion = { id: "answer", name: "Inhalt der Antwort", points: 1 };

  const aspects = points.map(({ points: value, text }) => ({
    criterionId: criterion.id,
    description: text,
    kind: "definitePoint" as const,
    points: value,
  }));

  return answers.map(({ id: answerId, score, text }) => ({
    expected: { earned: [], feedbackLanguage: "de", officialTotal: score, zero: false },
    id: `saf-${id}-${answerId}-de`,
    language: "de",
    userInput: {
      basis: basis({
        aspects,
        criteria: [criterion],
        grading: {
          criteria: [
            {
              citation: {
                passage: "Gewichtete Einzelpunkte der veröffentlichten Referenzantwort.",
                sourceId: SAF_SOURCE,
              },
              id: criterion.id,
              points: criterion.points,
              text: criterion.name,
            },
          ],
          language: null,
          rounding: null,
          zeroing: [],
        },
        lines: null,
        minimumWords: 1,
        taskKey: `saf-${id}`,
        title: criterion.name,
        total: 1,
      }),
      context: null,
      keyPoints: [],
      language: "de",
      numeric: true,
      question,
      text,
    },
  }));
});

export const SAF_KEY_SOURCES = [
  ...Map.groupBy(SAF_CASES, ({ userInput }) => userInput.basis.taskKey),
].map(([id, cases]) => {
  const [first] = cases;

  if (!first) {
    throw new Error("A key source needs a case.");
  }

  const {
    basis: { assessedSkillIds, grading, points },
    question,
  } = first.userInput;

  const notice = {
    ...grading,
    criteria: grading.criteria.map((criterion) => ({
      ...criterion,
      citation: { passage: "Bewertet wird der Inhalt der Kurzantwort.", sourceId: SAF_SOURCE },
    })),
  };

  return {
    cases,
    context: null,
    grading: notice,
    id,
    question,
    writerInput: {
      choices: [],
      drillSkillId: null,
      exam: "Kurzantworten zum deutschen Sozialrecht (Rechtsstand der zum Fall gehörenden Unterlagen)",
      language: "de",
      skills: assessedSkillIds.map((skillId) => ({
        id: skillId,
        name: "Sozialrechtliche Kurzfragen beantworten",
      })),
      subject: { name: "Deutsches Sozialrecht", topics: [] },
      task: {
        count: 1,
        description: "Eine kurze Frage zum deutschen Sozialrecht, höchstens ein Punkt.",
        grading: notice,
        handwritten: false,
        key: id,
        lines: null,
        minutes: null,
        points,
        section: "Kurzfragen",
        session: null,
      },
      unit: "answer" as const,
      usedTitles: [],
    },
  };
});
