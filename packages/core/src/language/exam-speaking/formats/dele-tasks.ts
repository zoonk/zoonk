import { type CefrLevel } from "@zoonk/utils/cefr";
import { type SpeakingTaskFormat, speakingTask } from "../speaking-format";

/**
 * DELE's speaking tasks by level, as the "Guía del examen" and Modelo 0 of each level describe them.
 * Preparation several tasks share is split between the ones with a card of their own, and the
 * learner is told the exam's whole time: at B2 the guide gives 20 minutes before the test for
 * Tasks 1 and 2 together, and the Modelo 0 candidate sheet says the same
 * (examenes.cervantes.es/sites/default/files/guia_examen_dele_b2_0.pdf, checked 10 Oct 2026). A
 * task that continues another's topic gets none of its own.
 */

const SILENT_EXAMINER = "The examiner gives the instruction, then listens without intervening.";

const A1: SpeakingTaskFormat[] = [
  speakingTask({
    brief: `The candidate introduces themself from a sheet of seven points: name, age, nationality, where they live, job or studies, personality, and languages they speak. ${SILENT_EXAMINER}`,
    key: "t1",
    minutes: { max: 2, min: 1 },
    mode: "monologue",
    name: "Tarea 1: Presentación personal",
    prepMinutes: 5,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief: `The candidate talks about an everyday topic (such as "My week"), choosing three of the five areas the sheet lists, with optional guiding questions. ${SILENT_EXAMINER}`,
    key: "t2",
    minutes: { max: 3, min: 2 },
    mode: "monologue",
    name: "Tarea 2: Exposición de un tema",
    options: 2,
    prepMinutes: 5,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "The examiner asks simple questions about what the candidate said on the Task 2 topic; then the candidate asks the examiner two questions about that topic, which the examiner answers briefly.",
    continues: "t2",
    cues: [
      {
        atSeconds: 120,
        say: "Now ask the candidate to ask you two questions about the topic, and answer each one briefly.",
      },
    ],
    key: "t3",
    minutes: { max: 4, min: 3 },
    mode: "interaction",
    name: "Tarea 3: Conversación con el entrevistador",
    role: "examiner",
    stimulus: "topic",
  }),
];

const A2: SpeakingTaskFormat[] = [
  speakingTask({
    brief: `A short talk on a topic chosen from two (such as "A trip I took"), following the points on the sheet, which include something that happened and plans. ${SILENT_EXAMINER}`,
    key: "t1",
    minutes: { max: 3, min: 2 },
    mode: "monologue",
    name: "Tarea 1: Exposición de un tema",
    options: 2,
    prepMinutes: 4,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief: `The candidate describes a photo, guided by about six questions: who the people are, the place, what they're doing, their relationship, how they feel, and what happened before or comes next. ${SILENT_EXAMINER}`,
    key: "t2",
    minutes: { max: 3, min: 2 },
    mode: "monologue",
    name: "Tarea 2: Descripción de una fotografía",
    options: 2,
    prepMinutes: 4,
    role: "examiner",
    stimulus: "photos",
  }),
  speakingTask({
    brief:
      "A role-play with the examiner in an everyday situation linked to the Task 2 photo (such as planning a surprise party with a sibling): the examiner plays the other person, follows a plan for the dialogue and improvises from the candidate's answers.",
    continues: "t2",
    key: "t3",
    minutes: { max: 4, min: 3 },
    mode: "rolePlay",
    name: "Tarea 3: Diálogo en una situación simulada",
    prepMinutes: 4,
    role: "examiner",
    stimulus: "topic",
  }),
];

const B1: SpeakingTaskFormat[] = [
  speakingTask({
    brief: `A short presentation on a topic chosen from two, from a sheet with the topic and guiding questions: an introduction, a development and a conclusion, with reasons for each opinion. ${SILENT_EXAMINER}`,
    key: "t1",
    minutes: { max: 3, min: 2 },
    mode: "monologue",
    name: "Tarea 1: Realizar una presentación breve",
    options: 2,
    prepMinutes: 15,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "A conversation with the examiner on the Task 1 topic: the examiner asks for the candidate's opinions and personal experience.",
    continues: "t1",
    key: "t2",
    minutes: { max: 4, min: 3 },
    mode: "interaction",
    name: "Tarea 2: Participar en una conversación",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "The candidate describes a photo for 1 to 2 minutes (the people, the place, objects, how the people are related, what they talk about), then the examiner asks questions linking the photo to the candidate's own life. Not prepared.",
    cues: [
      {
        atSeconds: 100,
        say: "When the candidate finishes describing the photo, ask your questions linking it to their own life.",
      },
    ],
    key: "t3",
    minutes: { max: 3, min: 2 },
    mode: "monologueThenInteraction",
    name: "Tarea 3: Describir una fotografía y participar en una conversación",
    options: 2,
    role: "examiner",
    stimulus: "photos",
  }),
  speakingTask({
    brief:
      "A role-play from the situation in the Task 3 photo (such as returning a broken laptop to a shop): the examiner plays the other person, and the candidate has four goals on a role card.",
    continues: "t3",
    key: "t4",
    minutes: { max: 3, min: 2 },
    mode: "rolePlay",
    name: "Tarea 4: Diálogo en una situación simulada",
    role: "examiner",
    stimulus: "topic",
  }),
];

const B2: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "The sheet describes a problem and five to seven proposals to solve it. The candidate weighs the pros and cons of at least four for 3 to 4 minutes without being interrupted, then talks with the examiner for 2 to 3 minutes: which proposal is best, the situation in their country, their opinions.",
    cues: [
      {
        atSeconds: 240,
        say: "The candidate's time to talk alone is up. When they finish their sentence, start the conversation: ask which proposal they think is best and why.",
      },
    ],
    key: "t1",
    minutes: { max: 7, min: 6 },
    mode: "monologueThenInteraction",
    name: "Tarea 1: Valorar propuestas y conversar sobre ellas",
    options: 2,
    prepMinutes: 10,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "From a photo, the candidate imagines the situation and describes it for 2 to 3 minutes, guided by about seven questions (there's no right answer); then the examiner asks about the candidate's own experiences and opinions on the theme.",
    cues: [
      {
        atSeconds: 180,
        say: "The candidate's time to talk alone is up. When they finish their sentence, ask about their own experiences and opinions on the theme.",
      },
    ],
    key: "t2",
    minutes: { max: 6, min: 5 },
    mode: "monologueThenInteraction",
    name: "Tarea 2: Describir una situación imaginada a partir de una fotografía y conversar sobre ella",
    options: 2,
    prepMinutes: 10,
    role: "examiner",
    stimulus: "photos",
  }),
  speakingTask({
    brief:
      "An informal conversation from survey results or figures on a trend: the candidate says what they would have answered, compares it with the results (where they agree and differ) and gives opinions, as the examiner asks. Not prepared.",
    key: "t3",
    minutes: { max: 4, min: 3 },
    mode: "interaction",
    name: "Tarea 3: Opinar sobre los datos de una encuesta",
    options: 2,
    role: "examiner",
    stimulus: "data",
  }),
];

const C1: SpeakingTaskFormat[] = [
  speakingTask({
    brief: `From a newspaper article of 750 to 850 words read during preparation, the candidate summarizes its main points, assesses the text (clarity, the author's intention, how solid the arguments are) and gives their opinion on the topic. ${SILENT_EXAMINER}`,
    cues: [
      {
        atSeconds: 180,
        say: "If the candidate hasn't started assessing the text and giving their opinion yet, tell them in one short sentence that about two minutes are left. Otherwise say nothing.",
      },
    ],
    key: "t1",
    minutes: { max: 5, min: 3 },
    mode: "monologue",
    name: "Tarea 1: Exposición oral sobre un tema",
    options: 2,
    prepMinutes: 20,
    role: "examiner",
    stimulus: "text",
  }),
  speakingTask({
    brief:
      "The examiner interviews the candidate on the Task 1 topic: questions that widen the topic, ask what the candidate would do in a situation, and relate the topic to their own life.",
    continues: "t1",
    key: "t2",
    minutes: { max: 6, min: 4 },
    mode: "interaction",
    name: "Tarea 2: Entrevista sobre un tema",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "The candidate and the examiner must agree, in a given situation, on one of four options shown as short ads or slogans. The examiner takes part as a co-participant with their own preferences, argues actively, may interrupt, and negotiates toward an agreement. The candidate reads the sheet for a minute first.",
    key: "t3",
    minutes: { max: 6, min: 4 },
    mode: "interaction",
    name: "Tarea 3: Conversación informal: negociación",
    options: 2,
    prepMinutes: 1,
    role: "examiner",
    stimulus: "topic",
  }),
];

const C2: SpeakingTaskFormat[] = [
  speakingTask({
    brief: `From two or three short texts (700 to 800 words in all) and one or two tables of figures on one topic, read during preparation, the candidate gives a talk following three given points and using every source. ${SILENT_EXAMINER}`,
    cues: [
      { atSeconds: 300, say: "Tell the candidate in one short sentence that one minute is left." },
    ],
    key: "t1",
    minutes: { max: 6, min: 5 },
    mode: "monologue",
    name: "Tarea 1: Exposición oral",
    options: 2,
    prepMinutes: 30,
    role: "examiner",
    stimulus: "text",
  }),
  speakingTask({
    brief:
      "The examiner asks for a justified opinion on the Task 1 topic and related questions, including about any source the candidate didn't mention.",
    continues: "t1",
    key: "t2",
    minutes: { max: 6, min: 5 },
    mode: "interaction",
    name: "Tarea 2: Entrevista sobre el tema de la exposición",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "Two news headlines, each with a subtitle. For about 2 minutes the candidate and the examiner agree, by the criteria given, which one to talk about; then for about 4 minutes they discuss that news. The examiner is a co-participant (such as a fellow organizer of a university debate club), never an interviewer. The candidate reads the sheet for a minute first.",
    cues: [
      {
        atSeconds: 120,
        say: "If you haven't agreed on a headline yet, agree on one now, then discuss that news together.",
      },
    ],
    key: "t3",
    minutes: { max: 6, min: 5 },
    mode: "interaction",
    name: "Tarea 3: Conversación sobre titulares de prensa",
    prepMinutes: 1,
    role: "examiner",
    stimulus: "topic",
  }),
];

export const DELE_TASKS: Readonly<Record<CefrLevel, readonly SpeakingTaskFormat[]>> = {
  A1,
  A2,
  B1,
  B2,
  C1,
  C2,
};
