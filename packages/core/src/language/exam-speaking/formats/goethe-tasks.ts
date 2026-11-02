import { type CefrLevel } from "@zoonk/utils/cefr";
import { type SpeakingTaskFormat, speakingTask } from "../speaking-format";

const A1: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "The candidate introduces themself from a keyword sheet (name, age, country, where they live, languages, job, hobby); then the examiner asks them to spell a word and to say a number.",
    key: "t1",
    minutes: { max: 2, min: 1 },
    mode: "monologueThenInteraction",
    name: "Teil 1: Sich vorstellen",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      'Two rounds on everyday themes (such as shopping): with a keyword card ("Bread"), the candidate asks their partner a question, then answers the question the partner asks with their own card.',
    key: "t2",
    minutes: { max: 3, min: 2 },
    mode: "interaction",
    name: "Teil 2: Um Informationen bitten und Informationen geben",
    role: "partner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "With picture cards of everyday objects (such as a glass of water or a window), the candidate makes a request or asks a favor, and reacts to the partner's request.",
    key: "t3",
    minutes: { max: 3, min: 2 },
    mode: "interaction",
    name: "Teil 3: Bitten formulieren und darauf reagieren",
    role: "partner",
    stimulus: "photos",
  }),
];

const A2: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "With four keyword cards (such as birthday, where you live, job, hobby), the candidate asks their partner four questions about themself and answers the partner's four.",
    key: "t1",
    minutes: { max: 3, min: 2 },
    mode: "interaction",
    name: "Teil 1: Fragen zur Person",
    role: "partner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      'The candidate talks about their own life from a question card with four or five prompts (such as "What do you do with your money?"), then answers one or two follow-up questions from the examiner.',
    key: "t2",
    minutes: { max: 3, min: 2 },
    mode: "monologueThenInteraction",
    name: "Teil 2: Von sich erzählen",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "The candidate and their partner each have a different diary page for the same day and must find a time to do something together (such as buying a present): ask, suggest, react and agree.",
    key: "t3",
    minutes: { max: 5, min: 4 },
    mode: "interaction",
    name: "Teil 3: Etwas zusammen planen",
    role: "partner",
    stimulus: "data",
  }),
];

const B1: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "The candidate and their partner plan something together from four prompts (such as visiting a sick classmate: when, how to get there, what to take, how to help): make suggestions, react to the partner's and agree.",
    key: "t1",
    minutes: { max: 3, min: 2 },
    mode: "interaction",
    name: "Teil 1: Gemeinsam etwas planen",
    prepMinutes: 5,
    role: "partner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "A presentation on a topic chosen from two, structured by five slides: introduce the topic and the structure, the candidate's own experience, the situation in their home country, pros and cons with their opinion, then close and thank the listeners. The examiner does not interrupt.",
    key: "t2",
    minutes: { max: 4, min: 3 },
    mode: "monologue",
    name: "Teil 2: Ein Thema präsentieren",
    options: 2,
    prepMinutes: 10,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "Feedback and questions on presentations: the partner first sums up their own presentation in about 30 seconds, the candidate gives feedback on it and asks one question; then the partner asks the candidate one question about the candidate's own presentation (Task 2), which the candidate answers.",
    continues: "t2",
    key: "t3",
    minutes: { max: 3, min: 2 },
    mode: "interaction",
    name: "Teil 3: Über ein Thema sprechen",
    role: "partner",
    stimulus: "topic",
  }),
];

const TALK_OVER = {
  say: "The talk's time is up. When the candidate finishes their sentence, thank them and ask one or two questions about the talk.",
};

const B2: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "A seminar-style talk of about 4 minutes with an introduction, a main part and a conclusion, following three prompts (describe several options, name and weigh their pros and cons, describe one in more detail); then questions on the talk, which the candidate answers.",
    cues: [{ atSeconds: 240, ...TALK_OVER }],
    key: "t1",
    minutes: { max: 6, min: 4 },
    mode: "monologueThenInteraction",
    name: "Teil 1: Vortrag halten",
    options: 2,
    prepMinutes: 10,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "A discussion with a partner on a debate-club question (such as whether students should rate their professors), with helper prompts: exchange positions, react to the partner's arguments and say at the end whether you're for or against.",
    key: "t2",
    minutes: { max: 5, min: 4 },
    mode: "interaction",
    name: "Teil 2: Diskussion führen",
    prepMinutes: 5,
    role: "partner",
    stimulus: "topic",
  }),
];

const C1: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "A well-structured seminar talk of about 5 minutes on a controversial question with four required points (such as give an example, argue for or against, say how parents and teachers should react, make a proposal); then about 2 minutes of questions on the talk.",
    cues: [{ atSeconds: 300, ...TALK_OVER }],
    key: "t1",
    minutes: { max: 7, min: 5 },
    mode: "monologueThenInteraction",
    name: "Teil 1: Vortrag halten",
    options: 2,
    prepMinutes: 12,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "A discussion with a colleague on a controversial topic from a short input text and four points: comment on it, justify your position, compare the situation in your country or another, and agree on arguments.",
    key: "t2",
    minutes: { max: 5, min: 4 },
    mode: "interaction",
    name: "Teil 2: Diskussion führen",
    prepMinutes: 8,
    role: "partner",
    stimulus: "text",
  }),
];

const C2: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "A free five-minute seminar talk from keyword notes, weighing viewpoints with three given quotations, with examples, a clear structure, demanding language and a clear personal stance; then the examiner asks follow-up questions for 2 to 3 minutes.",
    cues: [{ atSeconds: 300, ...TALK_OVER }],
    key: "t1",
    minutes: { max: 8, min: 7 },
    mode: "monologueThenInteraction",
    name: "Teil 1: Produktion",
    options: 2,
    prepMinutes: 10,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "The candidate takes the pro or the contra statement on a topic and opens the discussion; the examiner takes the opposite position. Defend the view with examples, respond to the examiner's arguments and try to persuade.",
    key: "t2",
    minutes: { max: 5, min: 4 },
    mode: "interaction",
    name: "Teil 2: Interaktion",
    options: 2,
    prepMinutes: 5,
    role: "examiner",
    stimulus: "topic",
  }),
];

/** Goethe paired-task timings are each candidate's share of the official pair or group time. */
export const GOETHE_TASKS: Readonly<Record<CefrLevel, readonly SpeakingTaskFormat[]>> = {
  A1,
  A2,
  B1,
  B2,
  C1,
  C2,
};
