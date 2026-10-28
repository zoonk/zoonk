import { type CefrLevel } from "@zoonk/utils/cefr";
import {
  type SpeakingFormat,
  type SpeakingScoreRow,
  evenPoints,
  speakingCriteria,
} from "../speaking-format";
import { GOETHE_TASKS } from "./goethe-tasks";

const LETTER_BANDS = 4;
const A1_BANDS = 2;

const criterion = speakingCriteria({
  display: "letter",
  halfBands: false,
  levelBand: null,
  maxBand: LETTER_BANDS,
  scope: "task",
});

const TASK_COMPLETION = criterion({ key: "taskCompletion", name: "Erfüllung" });
const INTERACTION = criterion({ key: "interaction", name: "Interaktion" });
const COHERENCE = criterion({ key: "coherence", name: "Kohärenz" });
const QUESTIONS = criterion({ key: "questions", name: "Fragen/Antworten" });
const VOCABULARY = criterion({ key: "vocabulary", name: "Wortschatz" });
const GRAMMAR = criterion({ key: "grammar", name: "Strukturen" });

const PRONUNCIATION = criterion({
  key: "pronunciation",
  name: "Aussprache",
  scope: "test",
  sound: true,
});

function sheetRows({
  paper = {},
  parts,
}: {
  paper?: Readonly<Record<string, number>>;
  parts: Readonly<Record<string, Readonly<Record<string, number>>>>;
}): SpeakingScoreRow[] {
  const partRows = Object.entries(parts).flatMap(([task, lines]) =>
    Object.entries(lines).map(([key, max]) => ({
      criterion: key,
      points: evenPoints({ max, maxBand: LETTER_BANDS }),
      task,
    })),
  );

  const paperRows = Object.entries(paper).map(([key, max]) => ({
    criterion: key,
    points: evenPoints({ max, maxBand: LETTER_BANDS }),
    task: null,
  }));

  return [...partRows, ...paperRows];
}

/** A2's pronunciation line (Aussprache) isn't even: E 0, D 0.5, C 2, B 3.5, A 5. */
const A2_PRONUNCIATION = { bandA: 5, bandB: 3.5, bandC: 2, bandD: 0.5 } as const;

const PAPER = "Modul Sprechen";
const MODULE_PASS = { kind: "paper", min: 60 } as const;
const HUNDRED = 100;

function source(file: string): string {
  return `https://www.goethe.de/pro/relaunch/prf/de/Durchfuehrungsbestimmungen_${file}.pdf`;
}

function goetheFormat(
  format: Omit<SpeakingFormat, "exam" | "paper" | "tasks"> & { level: CefrLevel },
): SpeakingFormat {
  return { ...format, exam: "goethe", paper: PAPER, tasks: GOETHE_TASKS[format.level] };
}

/** Goethe permits only the mark sheet's fixed band values; A1 uses full, half or no credit. */
export const GOETHE_FORMATS: readonly SpeakingFormat[] = [
  goetheFormat({
    criteria: [
      criterion({
        display: "points",
        key: "taskCompletion",
        maxBand: A1_BANDS,
        name: "Erfüllung der Aufgabenstellung und sprachliche Realisierung",
      }),
    ],
    level: "A1",
    minutes: { max: 15, min: 15 },
    pass: { kind: "none" },
    prepMinutes: 0,
    prepTasks: [],
    rows: [
      {
        criterion: "taskCompletion",
        points: evenPoints({ max: 3, maxBand: A1_BANDS }),
        task: "t1",
      },
      {
        criterion: "taskCompletion",
        points: evenPoints({ max: 6, maxBand: A1_BANDS }),
        task: "t2",
      },
      {
        criterion: "taskCompletion",
        points: evenPoints({ max: 6, maxBand: A1_BANDS }),
        task: "t3",
      },
    ],
    source: source("A1_Start_Deutsch_1"),
    title: "Goethe-Zertifikat A1: Start Deutsch 1",
    total: 15,
  }),
  goetheFormat({
    criteria: [
      criterion({ key: "taskCompletion", name: "Aufgabenerfüllung" }),
      criterion({ key: "language", name: "Sprache" }),
      PRONUNCIATION,
    ],
    level: "A2",
    minutes: { max: 15, min: 10 },
    pass: { kind: "paper", min: 15 },
    prepMinutes: 0,
    prepTasks: [],
    rows: [
      ...sheetRows({
        parts: {
          t1: { language: 2, taskCompletion: 2 },
          t2: { language: 4, taskCompletion: 4 },
          t3: { language: 4, taskCompletion: 4 },
        },
      }),
      {
        criterion: "pronunciation",
        points: [
          0,
          A2_PRONUNCIATION.bandD,
          A2_PRONUNCIATION.bandC,
          A2_PRONUNCIATION.bandB,
          A2_PRONUNCIATION.bandA,
        ],
        task: null,
      },
    ],
    source: source("A2"),
    title: "Goethe-Zertifikat A2",
    total: 25,
  }),
  goetheFormat({
    criteria: [TASK_COMPLETION, INTERACTION, COHERENCE, VOCABULARY, GRAMMAR, PRONUNCIATION],
    level: "B1",
    minutes: { max: 15, min: 10 },
    pass: MODULE_PASS,
    prepMinutes: 15,
    prepTasks: ["t1", "t2", "t3"],
    rows: sheetRows({
      paper: { pronunciation: 16 },
      parts: {
        t1: { grammar: 8, interaction: 4, taskCompletion: 8, vocabulary: 8 },
        t2: { coherence: 4, grammar: 12, taskCompletion: 12, vocabulary: 12 },
        t3: { taskCompletion: 16 },
      },
    }),
    source: source("B1"),
    title: "Goethe-Zertifikat B1",
    total: HUNDRED,
  }),
  goetheFormat({
    criteria: [
      TASK_COMPLETION,
      COHERENCE,
      QUESTIONS,
      INTERACTION,
      VOCABULARY,
      GRAMMAR,
      PRONUNCIATION,
    ],
    level: "B2",
    minutes: { max: 15, min: 10 },
    pass: MODULE_PASS,
    prepMinutes: 15,
    prepTasks: ["t1", "t2"],
    rows: sheetRows({
      paper: { pronunciation: 16 },
      parts: {
        t1: { coherence: 8, grammar: 8, questions: 12, taskCompletion: 8, vocabulary: 8 },
        t2: { grammar: 10, interaction: 10, taskCompletion: 10, vocabulary: 10 },
      },
    }),
    source: source("B2"),
    title: "Goethe-Zertifikat B2",
    total: HUNDRED,
  }),
  goetheFormat({
    criteria: [
      TASK_COMPLETION,
      COHERENCE,
      QUESTIONS,
      INTERACTION,
      VOCABULARY,
      GRAMMAR,
      PRONUNCIATION,
    ],
    level: "C1",
    minutes: { max: 20, min: 15 },
    pass: MODULE_PASS,
    prepMinutes: 20,
    prepTasks: ["t1", "t2"],
    rows: sheetRows({
      paper: { pronunciation: 16 },
      parts: {
        t1: { coherence: 10, grammar: 10, questions: 12, taskCompletion: 10, vocabulary: 10 },
        t2: { grammar: 10, interaction: 4, taskCompletion: 8, vocabulary: 10 },
      },
    }),
    source: source("C1"),
    title: "Goethe-Zertifikat C1",
    total: HUNDRED,
  }),
  goetheFormat({
    criteria: [
      TASK_COMPLETION,
      COHERENCE,
      VOCABULARY,
      GRAMMAR,
      criterion({ key: "pronunciation", name: "Aussprache und Intonation", sound: true }),
    ],
    level: "C2",
    minutes: { max: 15, min: 15 },
    pass: MODULE_PASS,
    prepMinutes: 15,
    prepTasks: ["t1", "t2"],
    rows: sheetRows({
      parts: {
        t1: { coherence: 10, grammar: 10, pronunciation: 10, taskCompletion: 10, vocabulary: 10 },
        t2: { coherence: 10, grammar: 10, pronunciation: 10, taskCompletion: 10, vocabulary: 10 },
      },
    }),
    source: source("C2_neu"),
    title: "Goethe-Zertifikat C2: Großes Deutsches Sprachdiplom",
    total: HUNDRED,
  }),
];
