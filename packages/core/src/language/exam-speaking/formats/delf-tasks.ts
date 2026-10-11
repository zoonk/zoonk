import { type CefrLevel } from "@zoonk/utils/cefr";
import { type SpeakingTaskFormat, speakingTask } from "../speaking-format";

/**
 * DELF and DALF's individual speaking parts by level, from the July 2026 "Manuel du candidat", the
 * official sample papers and the level pages (france-education-international.fr, checked 10 Oct
 * 2026; round7/speaking/formats.md has the quotes). The parts run back to back in the exam.
 */

const SILENT_JURY = "The examiner does not intervene.";

const A1: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "A guided interview without preparation: the examiner asks the candidate simple questions about themself, their family, tastes and activities.",
    key: "p1",
    minutes: { max: 1, min: 1 },
    mode: "interaction",
    name: "Partie 1 : Entretien dirigé",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      'An exchange of information: from six word cards (such as "Date of birth"), the candidate asks the examiner questions to get to know them, and the examiner answers briefly.',
    key: "p2",
    minutes: { max: 2, min: 2 },
    mode: "interaction",
    name: "Partie 2 : Échange d'informations",
    prepMinutes: 5,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "A simulated dialogue with the examiner in an everyday situation, such as asking prices and quantities and paying in a shop, with polite phrases.",
    key: "p3",
    minutes: { max: 2, min: 2 },
    mode: "rolePlay",
    name: "Partie 3 : Dialogue simulé (ou jeu de rôle)",
    options: 2,
    prepMinutes: 5,
    role: "examiner",
    stimulus: "topic",
  }),
];

const A2: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "A guided interview without preparation: the candidate introduces themself (family, friends, studies, tastes), then the examiner asks follow-up questions.",
    key: "p1",
    minutes: { max: 2, min: 1 },
    mode: "monologueThenInteraction",
    name: "Partie 1 : Entretien dirigé",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "The candidate talks about an everyday topic chosen from two, answering every guiding question on the card; the examiner may then ask a question or two.",
    key: "p2",
    minutes: { max: 2, min: 2 },
    mode: "monologue",
    name: "Partie 2 : Monologue suivi",
    options: 2,
    prepMinutes: 5,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "A simulated dialogue with the examiner to sort out an everyday situation (buying, booking, inviting), with greetings and polite forms.",
    key: "p3",
    minutes: { max: 4, min: 3 },
    mode: "rolePlay",
    name: "Partie 3 : Exercice en interaction",
    options: 2,
    prepMinutes: 5,
    role: "examiner",
    stimulus: "topic",
  }),
];

const B1: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      "A guided interview without preparation: the examiner asks about the candidate, their activities, interests, past and plans; the candidate should talk on their own for at least a minute and a half.",
    key: "p1",
    minutes: { max: 3, min: 2 },
    mode: "interaction",
    name: "Partie 1 : Entretien dirigé",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "A role-play without preparation in an unusual everyday situation (such as asking for a refund): the candidate solves a problem, gives an opinion and makes proposals while the examiner plays the other person.",
    key: "p2",
    minutes: { max: 4, min: 3 },
    mode: "rolePlay",
    name: "Partie 2 : Exercice en interaction",
    options: 2,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "From a short document of a few lines, the candidate identifies its theme and gives a personal talk of about three minutes with their point of view; the examiner then asks a few questions.",
    cues: [
      {
        atSeconds: 180,
        say: "When the candidate finishes their talk, ask a few short questions about their point of view.",
      },
    ],
    key: "p3",
    minutes: { max: 7, min: 5 },
    mode: "monologueThenInteraction",
    name: "Partie 3 : Expression d'un point de vue",
    options: 2,
    prepMinutes: 10,
    role: "examiner",
    stimulus: "text",
  }),
];

const B2: SpeakingTaskFormat[] = [
  speakingTask({
    brief: `From a short trigger document, the candidate draws out the problem it raises and defends a clear, argued point of view: a question to answer, an announced plan, examples, an introduction and a conclusion. ${SILENT_JURY}`,
    key: "p1",
    minutes: { max: 7, min: 5 },
    mode: "monologue",
    name: "Partie 1 : Monologue suivi (défense d'un point de vue argumenté)",
    options: 2,
    prepMinutes: 30,
    role: "examiner",
    stimulus: "text",
  }),
  speakingTask({
    brief:
      "A debate with the examiner on the point of view the candidate defended: the examiner challenges it with questions and counterarguments, and the candidate defends, nuances and clarifies it.",
    continues: "p1",
    key: "p2",
    minutes: { max: 13, min: 10 },
    mode: "interaction",
    name: "Partie 2 : Exercice en interaction (débat)",
    role: "examiner",
    stimulus: "topic",
  }),
];

const C1: SpeakingTaskFormat[] = [
  speakingTask({
    brief: `From a dossier of several short documents on one theme, the candidate gives an ordered talk with an introduction, a conclusion and three or four main points; the documents are a source, never just summarized. ${SILENT_JURY}`,
    key: "p1",
    minutes: { max: 10, min: 8 },
    mode: "monologue",
    name: "Partie 1 : Exposé",
    options: 2,
    prepMinutes: 60,
    role: "examiner",
    stimulus: "text",
  }),
  speakingTask({
    brief:
      "An interview with the jury on the talk: the examiner asks questions and discusses the candidate's positions, which the candidate defends and develops.",
    continues: "p1",
    key: "p2",
    minutes: { max: 20, min: 15 },
    mode: "interaction",
    name: "Partie 2 : Entretien",
    role: "examiner",
    stimulus: "topic",
  }),
];

/** In the exam the document is a recording of about 15 minutes, heard twice; here it's read. */
const C2: SpeakingTaskFormat[] = [
  speakingTask({
    brief: `The candidate reports the content of a document (a radio programme or a talk) they studied during preparation. ${SILENT_JURY}`,
    key: "p1",
    minutes: { max: 10, min: 5 },
    mode: "monologue",
    name: "Partie 1 : Présentation du document",
    prepMinutes: 30,
    role: "examiner",
    stimulus: "text",
  }),
  speakingTask({
    brief: `In a given role (such as a citizen speaking on a radio show), the candidate develops a personal, argued point of view on the issue the document raises. ${SILENT_JURY}`,
    continues: "p1",
    key: "p2",
    minutes: { max: 10, min: 10 },
    mode: "monologue",
    name: "Partie 2 : Point de vue argumenté",
    options: 2,
    prepMinutes: 30,
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      "A debate with the jury on the candidate's point of view: they defend, nuance and clarify it, and no specialist knowledge is needed.",
    continues: "p2",
    key: "p3",
    minutes: { max: 10, min: 10 },
    mode: "interaction",
    name: "Partie 3 : Débat",
    role: "examiner",
    stimulus: "topic",
  }),
];

export const DELF_TASKS: Readonly<Record<CefrLevel, readonly SpeakingTaskFormat[]>> = {
  A1,
  A2,
  B1,
  B2,
  C1,
  C2,
};
