import { type TestCase } from "@/lib/types";
import { type GenerateExamSpeakingCardParams } from "@zoonk/ai/tasks/v2/language/exam-speaking-card";
import { type SpeakingExam } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { getSpeakingFormat, getSpeakingTask } from "@zoonk/core/language/exam-speaking/formats";
import { type CefrLevel } from "@zoonk/utils/cefr";

export type ExamSpeakingCardInput = Omit<
  GenerateExamSpeakingCardParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

function cardInput({
  exam,
  learnerLanguage,
  level,
  previous = null,
  task,
}: {
  exam: SpeakingExam;
  learnerLanguage: string;
  level: CefrLevel;
  previous?: ExamSpeakingCardInput["previous"];
  task: string;
}): ExamSpeakingCardInput {
  const format = getSpeakingFormat({ exam, level });
  const found = format ? getSpeakingTask({ format, task }) : null;

  if (!format || !found) {
    throw new Error(`No ${exam} ${level} task ${task}`);
  }

  return {
    exam,
    learnerLanguage,
    level,
    paper: format.paper,
    previous,
    task: {
      brief: found.brief,
      minutes: found.minutes.max,
      name: found.name,
      role: found.role,
      stimulus: found.stimulus,
    },
    title: format.title,
  };
}

export const TEST_CASES: TestCase<unknown, ExamSpeakingCardInput>[] = [
  {
    expectations: `DELE B2 Task 1 for a Brazilian candidate: a problem and five to seven proposals to solve it on the card (the prompts), instructions in Spain Spanish with "usted" saying to weigh at least four for 3 to 4 minutes and then talk with the examiner. No photos, text or table. The examiner's brief listens without interrupting through the monologue, then asks which proposal is best, about the candidate's country and their opinion. Summary and role in Brazilian Portuguese.`,
    id: "pt-es-dele-b2-proposals",
    userInput: cardInput({ exam: "dele", learnerLanguage: "pt", level: "B2", task: "t1" }),
  },
  {
    expectations: `DELE A2 Task 2 for a Brazilian candidate: one photo scene in English of an everyday moment with people (who, what they wear, what they do, where, the light) and nothing to read in it, its alt in Brazilian Portuguese, and about six guiding questions in simple Spain Spanish (who the people are, the place, what they're doing, how they feel, what happened before). The examiner gives the instruction and listens.`,
    id: "pt-es-dele-a2-photo",
    userInput: cardInput({ exam: "dele", learnerLanguage: "pt", level: "A2", task: "t2" }),
  },
  {
    expectations: `DELF B2 Part 1 for a Brazilian candidate: a short trigger document in French (a press article of about 200 to 250 words with a title) raising a debatable social question without telling the candidate what to think, instructions with "vous" to draw out the problem and defend an argued point of view with a plan, and prompts on what to cover. The examiner listens silently through the monologue.`,
    id: "pt-fr-delf-b2-document",
    userInput: cardInput({ exam: "delf", learnerLanguage: "pt", level: "B2", task: "p1" }),
  },
  {
    expectations: `DELE B2 Task 3 for a Brazilian candidate: a survey table in Spain Spanish with its question as the title and an invented but plausible source and year, 3 to 8 rows of answers with percentages that add up to 100, and the examiner's questions about which data stand out, how they compare with the candidate's country and their own habits.`,
    id: "pt-es-dele-b2-survey",
    userInput: cardInput({ exam: "dele", learnerLanguage: "pt", level: "B2", task: "t3" }),
  },
  {
    expectations: `Goethe-Zertifikat B1 Part 1 for a Brazilian candidate, with the AI as the other candidate: a situation to plan together with four prompts in German ("Sie" in the instructions), and a partner brief with its own suggestions, reactions and some disagreement, speaking about half the time in short turns and helping agree on a plan. The opening line is the partner starting the planning with a question. Role "outra candidata" or "outro candidato".`,
    id: "pt-de-goethe-b1-plan-together",
    userInput: cardInput({ exam: "goethe", learnerLanguage: "pt", level: "B1", task: "t1" }),
  },
  {
    expectations: `B2 First Part 3 for a Spanish-speaking candidate, with the AI as the other candidate: a discussion question with five written prompts in British English, and a partner brief with its own views, sometimes disagreeing, inviting the candidate's opinion and, after about two minutes, working toward a decision. Summary, role ("otra candidata" or "otro candidato") and photo alts, if any, in Spanish.`,
    id: "es-en-cambridge-b2-collaborative",
    userInput: cardInput({ exam: "cambridge", learnerLanguage: "es", level: "B2", task: "p3" }),
  },
  {
    expectations: `B2 First Part 2 for a Brazilian candidate: two photo scenes in English of people doing the same kind of thing in different ways, with alts in Brazilian Portuguese; the one question printed over the photos in British English as the only prompt; instructions to compare the photos and answer the question in about a minute. No line refers to where things are on the card ("the question above them" is a flaw: the app lays the card out). The examiner's brief gives the standard instruction, listens for a minute, then asks one short follow-up question. Found on a real run that wrote "answer the question above them".`,
    id: "pt-en-cambridge-b2-long-turn-photos",
    userInput: cardInput({ exam: "cambridge", learnerLanguage: "pt", level: "B2", task: "p2" }),
  },
  {
    expectations: `DELE B1 Task 2 continues Task 1's presentation on working from home: the card and the examiner's questions stay on that topic, asking for the candidate's opinions and personal experience about it, never a new topic. In Spain Spanish with "usted"; summary in Brazilian Portuguese.`,
    id: "pt-es-dele-b1-continues-presentation",
    userInput: cardInput({
      exam: "dele",
      learnerLanguage: "pt",
      level: "B1",
      previous: {
        instructions: [
          "Prepare una presentación de 2 a 3 minutos sobre el tema.",
          "Incluya una introducción, el desarrollo y una conclusión.",
        ],
        prompts: [
          "¿Trabajar desde casa es una ventaja o un problema?",
          "¿Qué necesita una persona para trabajar bien en casa?",
          "¿Cómo cambia la relación con los compañeros?",
          "¿Qué prefiere usted y por qué?",
        ],
        table: null,
        task: "Tarea 1: Realizar una presentación breve",
        text: null,
      },
      task: "t2",
    }),
  },
];
