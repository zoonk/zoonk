import { type CefrLevel } from "@zoonk/utils/cefr";
import {
  type SpeakingCriterionFormat,
  type SpeakingFormat,
  type SpeakingScoreRow,
  evenPoints,
} from "../speaking-format";
import { DELE_TASKS } from "./dele-tasks";

/**
 * DELE's "Prueba de expresión e interacción orales" (C1 and C2 since 2024: "Expresión, mediación e
 * interacción orales"), from the level pages, the "Guía del examen" and the Modelo 0 of each level
 * (examenes.cervantes.es, checked 10 Oct 2026). Two examiners: the interviewer talks with the
 * candidate and gives one holistic band for the whole paper (40%), the rater stays silent and gives
 * each task its bands (60%). Every scale runs 0 to 3, and band 2 is the level (the guide says the
 * band worth 2 points is equivalent to the level's description). Points are the weighted band
 * times 25 over 3 (33.34 at C2). A1 to C1 pass with 30 of 50 in the group of listening and speaking;
 * C2 needs 20 of 33.34 in the oral itself. Pronunciation is part of "Uso de la lengua" (A1, A2) and
 * "Fluidez" (B1 to C2), judged by how easily it's understood: a foreign accent is fine at band 2.
 */

const MAX_BAND = 3;
const LEVEL_BAND = 2;
const RATER_SHARE = 0.6;
const INTERVIEWER_SHARE = 0.4;
const PAPER_POINTS = 25;
const C2_PAPER_POINTS = 33.34;

const GROUP_PASS = { kind: "group", min: 30, of: 50 } as const;

function criterion({
  key,
  name,
  scope = "task",
  sound = false,
  voiceOnly = sound,
}: {
  key: string;
  name: string;
  scope?: "task" | "test";
  sound?: boolean;
  voiceOnly?: boolean;
}): SpeakingCriterionFormat {
  return {
    display: "band",
    halfBands: false,
    key,
    levelBand: LEVEL_BAND,
    maxBand: MAX_BAND,
    name,
    scope,
    sound,
    voiceOnly,
  };
}

/** The rater's task bands (each task and criterion its share of 60%) and the interviewer's 40%. */
function deleRows({
  criteria,
  holistic,
  tasks,
  total,
}: {
  criteria: Readonly<Record<string, number>>;
  holistic: string;
  tasks: Readonly<Record<string, number>>;
  total: number;
}): SpeakingScoreRow[] {
  const taskRows = Object.entries(tasks).flatMap(([task, taskShare]) =>
    Object.entries(criteria).map(([key, criterionShare]) => ({
      criterion: key,
      points: evenPoints({
        max: total * RATER_SHARE * taskShare * criterionShare,
        maxBand: MAX_BAND,
      }),
      task,
    })),
  );

  return [
    ...taskRows,
    {
      criterion: holistic,
      points: evenPoints({ max: total * INTERVIEWER_SHARE, maxBand: MAX_BAND }),
      task: null,
    },
  ];
}

const BASIC_CRITERIA = [
  // Words and how easily they're understood: typed replies still show the words.
  criterion({ key: "languageUse", name: "Uso de la lengua", sound: true, voiceOnly: false }),
  criterion({ key: "taskCompletion", name: "Cumplimiento de la tarea" }),
  criterion({ key: "interviewer", name: "Escala del interviewer", scope: "test" }),
];

/** Inside every A1 and A2 band, language use weighs 66% and doing the task 34%. */
const BASIC_SHARES = { languageUse: 0.66, taskCompletion: 0.34 };

/** The B1 and B2 guides give no weights for their four criteria, so they count the same. */
const INTERMEDIATE_CRITERIA = [
  criterion({ key: "coherence", name: "Coherencia" }),
  criterion({ key: "fluency", name: "Fluidez", sound: true }),
  criterion({ key: "accuracy", name: "Corrección" }),
  criterion({ key: "range", name: "Alcance" }),
  criterion({ key: "holistic", name: "Escala holística", scope: "test" }),
];

const INTERMEDIATE_SHARES = { accuracy: 0.25, coherence: 0.25, fluency: 0.25, range: 0.25 };

const ADVANCED_CRITERIA = [
  criterion({ key: "fluency", name: "Fluidez", sound: true }),
  criterion({ key: "accuracy", name: "Corrección" }),
  criterion({ key: "range", name: "Alcance" }),
  criterion({ key: "taskCompletion", name: "Cumplimiento de la tarea" }),
  criterion({ key: "holistic", name: "Escala holística", scope: "test" }),
];

const ADVANCED_SHARES = { accuracy: 0.22, fluency: 0.22, range: 0.22, taskCompletion: 0.34 };

/** C1 and C2 weigh their three tasks the same. */
const THIRD = 1 / 3;

function source(level: CefrLevel): string {
  return `https://examenes.cervantes.es/es/dele/examenes/${level.toLowerCase()}`;
}

const PAPER = "Prueba 4: Expresión e interacción orales";
const MEDIATION_PAPER = "Expresión, mediación e interacción orales";

export const DELE_FORMATS: readonly SpeakingFormat[] = [
  {
    criteria: BASIC_CRITERIA,
    exam: "dele",
    level: "A1",
    minutes: { max: 10, min: 10 },
    paper: PAPER,
    pass: GROUP_PASS,
    prepMinutes: 10,
    prepTasks: ["t1", "t2"],
    rows: deleRows({
      criteria: BASIC_SHARES,
      holistic: "interviewer",
      tasks: { t1: 0.2, t2: 0.35, t3: 0.45 },
      total: PAPER_POINTS,
    }),
    source: source("A1"),
    tasks: DELE_TASKS.A1,
    title: "DELE A1",
    total: PAPER_POINTS,
  },
  {
    criteria: BASIC_CRITERIA,
    exam: "dele",
    level: "A2",
    minutes: { max: 12, min: 12 },
    paper: PAPER,
    pass: GROUP_PASS,
    prepMinutes: 12,
    prepTasks: ["t1", "t2", "t3"],
    rows: deleRows({
      criteria: BASIC_SHARES,
      holistic: "interviewer",
      tasks: { t1: 0.25, t2: 0.25, t3: 0.5 },
      total: PAPER_POINTS,
    }),
    source: source("A2"),
    tasks: DELE_TASKS.A2,
    title: "DELE A2",
    total: PAPER_POINTS,
  },
  {
    criteria: INTERMEDIATE_CRITERIA,
    exam: "dele",
    level: "B1",
    minutes: { max: 15, min: 15 },
    paper: PAPER,
    pass: GROUP_PASS,
    prepMinutes: 15,
    prepTasks: ["t1", "t2"],
    // Tasks 1 and 2 share one band and Tasks 3 and 4 another, half each: a quarter per task.
    rows: deleRows({
      criteria: INTERMEDIATE_SHARES,
      holistic: "holistic",
      tasks: { t1: 0.25, t2: 0.25, t3: 0.25, t4: 0.25 },
      total: PAPER_POINTS,
    }),
    source: source("B1"),
    tasks: DELE_TASKS.B1,
    title: "DELE B1",
    total: PAPER_POINTS,
  },
  {
    criteria: INTERMEDIATE_CRITERIA,
    exam: "dele",
    level: "B2",
    minutes: { max: 20, min: 20 },
    paper: PAPER,
    pass: GROUP_PASS,
    prepMinutes: 20,
    prepTasks: ["t1", "t2"],
    rows: deleRows({
      criteria: INTERMEDIATE_SHARES,
      holistic: "holistic",
      tasks: { t1: 0.35, t2: 0.35, t3: 0.3 },
      total: PAPER_POINTS,
    }),
    source: source("B2"),
    tasks: DELE_TASKS.B2,
    title: "DELE B2",
    total: PAPER_POINTS,
  },
  {
    criteria: ADVANCED_CRITERIA,
    exam: "dele",
    level: "C1",
    minutes: { max: 20, min: 20 },
    paper: `Prueba 4: ${MEDIATION_PAPER}`,
    pass: GROUP_PASS,
    prepMinutes: 20,
    prepTasks: ["t1", "t2"],
    rows: deleRows({
      criteria: ADVANCED_SHARES,
      holistic: "holistic",
      tasks: { t1: THIRD, t2: THIRD, t3: THIRD },
      total: PAPER_POINTS,
    }),
    source: source("C1"),
    tasks: DELE_TASKS.C1,
    title: "DELE C1",
    total: PAPER_POINTS,
  },
  {
    criteria: ADVANCED_CRITERIA,
    exam: "dele",
    level: "C2",
    minutes: { max: 20, min: 20 },
    paper: `Prueba 3: ${MEDIATION_PAPER}`,
    pass: { kind: "paper", min: 20 },
    prepMinutes: 30,
    prepTasks: ["t1"],
    rows: deleRows({
      criteria: ADVANCED_SHARES,
      holistic: "holistic",
      tasks: { t1: THIRD, t2: THIRD, t3: THIRD },
      total: C2_PAPER_POINTS,
    }),
    source: source("C2"),
    tasks: DELE_TASKS.C2,
    title: "DELE C2",
    total: C2_PAPER_POINTS,
  },
];
