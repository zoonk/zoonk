import { type CefrLevel } from "@zoonk/utils/cefr";
import {
  type SpeakingFormat,
  type SpeakingScoreRow,
  type SpeakingTaskFormat,
  speakingCriteria,
} from "../speaking-format";
import { DELF_TASKS } from "./delf-tasks";

/**
 * DELF and DALF's individual speaking paper, marked on the official grid in use since September
 * 2022 (grille-po-*, the performance descriptors): one "Réalisation de la tâche" line per part,
 * then Lexique, Morphosyntaxe and "Maîtrise du système phonologique" for the whole paper. Each line
 * has four columns: insufficient, below the level, at the level, above it. The paper is out of 25
 * (DALF C2's speaking is out of 50), and under 5 of 25 in any paper fails the whole exam, which
 * needs 50 of 100. The phonology descriptors judge intelligibility; the B2+ column even says a
 * foreign accent doesn't affect understanding.
 */

const MAX_BAND = 3;
/** At the level: the third of the four columns. */
const LEVEL_BAND = 2;

const criterion = speakingCriteria({
  display: "points",
  halfBands: false,
  levelBand: LEVEL_BAND,
  maxBand: MAX_BAND,
  scope: "test",
});

const CRITERIA = [
  criterion({ key: "taskCompletion", name: "Réalisation de la tâche", scope: "task" }),
  criterion({ key: "vocabulary", name: "Lexique" }),
  criterion({ key: "grammar", name: "Morphosyntaxe" }),
  criterion({ key: "pronunciation", name: "Maîtrise du système phonologique", sound: true }),
];

/** The grid's columns give 0, 1, 2.5 and 4 points on a line out of 4, and 0, 1, 3 and 5 out of 5. */
const GRID_LINES = {
  outOf4: { above: 4, at: 2.5, below: 1 },
  outOf5: { above: 5, at: 3, below: 1 },
} as const;

type GridLine = keyof typeof GRID_LINES;

/**
 * The grid's lines: each part's task line, then the three language lines. DALF C2 counts its grid
 * twice (out of 50).
 */
function gridRows({
  others,
  scale = 1,
  task,
  tasks,
  vocabulary,
}: {
  others: GridLine;
  scale?: number;
  task: GridLine;
  tasks: readonly SpeakingTaskFormat[];
  vocabulary: GridLine;
}): SpeakingScoreRow[] {
  const points = (line: GridLine) => {
    const { above, at, below } = GRID_LINES[line];
    return [0, below, at, above].map((value) => value * scale);
  };

  return [
    ...tasks.map((item) => ({ criterion: "taskCompletion", points: points(task), task: item.key })),
    { criterion: "vocabulary", points: points(vocabulary), task: null },
    { criterion: "grammar", points: points(others), task: null },
    { criterion: "pronunciation", points: points(others), task: null },
  ];
}

const PAPER_POINTS = 25;
const DALF_C2_SCALE = 2;
const FLOOR = { kind: "floor", min: 5 } as const;

const DELF_PAGE = "https://www.france-education-international.fr/diplome/delf-tout-public/niveau-";
const DALF_PAGE = "https://www.france-education-international.fr/article/dalf-";

function delfFormat({
  level,
  minutes,
  prepMinutes,
  prepTasks,
  rows,
  source,
}: {
  level: CefrLevel;
  minutes: SpeakingFormat["minutes"];
  prepMinutes: number;
  prepTasks: string[];
  rows: (tasks: readonly SpeakingTaskFormat[]) => SpeakingScoreRow[];
  source: string;
}): SpeakingFormat {
  const tasks = DELF_TASKS[level];
  const dalf = level === "C1" || level === "C2";

  return {
    criteria: CRITERIA,
    exam: "delf",
    level,
    minutes,
    paper: dalf ? "Production orale (DALF)" : "Production orale",
    pass: FLOOR,
    prepMinutes,
    prepTasks,
    rows: rows(tasks),
    source,
    tasks,
    title: `${dalf ? "DALF" : "DELF"} ${level}`,
    total: PAPER_POINTS,
  };
}

export const DELF_FORMATS: readonly SpeakingFormat[] = [
  delfFormat({
    level: "A1",
    minutes: { max: 7, min: 5 },
    prepMinutes: 10,
    prepTasks: ["p2", "p3"],
    rows: (tasks) => gridRows({ others: "outOf4", task: "outOf4", tasks, vocabulary: "outOf5" }),
    source: `${DELF_PAGE}a1`,
  }),
  delfFormat({
    level: "A2",
    minutes: { max: 8, min: 6 },
    prepMinutes: 10,
    prepTasks: ["p2", "p3"],
    rows: (tasks) => gridRows({ others: "outOf4", task: "outOf4", tasks, vocabulary: "outOf5" }),
    source: `${DELF_PAGE}a2`,
  }),
  delfFormat({
    level: "B1",
    minutes: { max: 15, min: 10 },
    prepMinutes: 10,
    prepTasks: ["p3"],
    rows: (tasks) => gridRows({ others: "outOf4", task: "outOf4", tasks, vocabulary: "outOf5" }),
    source: `${DELF_PAGE}b1`,
  }),
  delfFormat({
    level: "B2",
    minutes: { max: 20, min: 20 },
    prepMinutes: 30,
    prepTasks: ["p1"],
    rows: (tasks) => gridRows({ others: "outOf5", task: "outOf5", tasks, vocabulary: "outOf5" }),
    source: `${DELF_PAGE}b2`,
  }),
  delfFormat({
    level: "C1",
    minutes: { max: 30, min: 30 },
    prepMinutes: 60,
    prepTasks: ["p1"],
    rows: (tasks) => gridRows({ others: "outOf5", task: "outOf5", tasks, vocabulary: "outOf5" }),
    source: `${DALF_PAGE}c1`,
  }),
  {
    ...delfFormat({
      level: "C2",
      minutes: { max: 30, min: 30 },
      prepMinutes: 60,
      prepTasks: ["p1", "p2"],
      rows: (tasks) =>
        gridRows({
          others: "outOf4",
          scale: DALF_C2_SCALE,
          task: "outOf4",
          tasks,
          vocabulary: "outOf5",
        }),
      source: `${DALF_PAGE}c2`,
    }),
    paper: "Compréhension et production orales (DALF)",
    pass: { kind: "floor", min: 10 },
    total: PAPER_POINTS * DALF_C2_SCALE,
  },
];
