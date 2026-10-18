import { type SpeakingExam } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { type CefrLevel } from "@zoonk/utils/cefr";

/** Who the AI plays: the examiner who asks and listens, or the other candidate of a paired task. */
type SpeakingRole = "examiner" | "partner";

/**
 * How the candidate speaks in a task: on their own, with the examiner or partner, on their own and
 * then with the examiner about it, or in a role the task sets.
 */
type SpeakingMode = "monologue" | "interaction" | "monologueThenInteraction" | "rolePlay";

/**
 * What the task card gives the candidate besides its instructions: guiding points only (`topic`),
 * one or more photos, a text to work from (an article, a dossier, a document), or figures (a survey,
 * a chart's data).
 */
type SpeakingStimulus = "topic" | "photos" | "text" | "data";

/** Something the app tells the AI at a moment of the task, as a real examiner keeps time. */
type SpeakingCue = { atSeconds: number; say: string };

export type SpeakingTaskFormat = {
  key: string;
  /** The task's official name, in the exam's language, as the exam's papers print it. */
  name: string;
  role: SpeakingRole;
  mode: SpeakingMode;
  /** The task's official speaking time, in minutes; the call runs to `max`. */
  minutes: { max: number; min: number };
  /**
   * Preparation the exam gives this task, in minutes: its own, or its share of a preparation that
   * covers several tasks (`SpeakingFormat.prepMinutes`). Zero when it isn't prepared.
   */
  prepMinutes: number;
  /** How many cards the exam offers to choose from; 1 when there's no choice. */
  options: number;
  stimulus: SpeakingStimulus;
  /** What the candidate does, in English, for the models that write the card and play the task. */
  brief: string;
  cues: readonly SpeakingCue[];
  /** The earlier task whose topic or card this one continues ("about the topic of Task 1"). */
  continues?: string;
};

/**
 * How a criterion's bands read on its official scale: a number (DELE's 0 to 3, Cambridge's 0 to 5),
 * the points its row gives (DELF's grid, Goethe A1), or a letter (Goethe's A to E, A the best).
 */
type SpeakingBandDisplay = "band" | "letter" | "points";

export type SpeakingCriterionFormat = {
  key: string;
  /** The official name, in the exam's language. */
  name: string;
  /** Rated in each task (`task`), or once for the whole paper from every task (`test`). */
  scope: "task" | "test";
  /** The highest band; bands run from 0. */
  maxBand: number;
  /** Cambridge allows half bands; the others don't. */
  halfBands: boolean;
  /** The band the scale writes for the exam's own level, when it names one. */
  levelBand: number | null;
  display: SpeakingBandDisplay;
  /** How the candidate sounds: graded for intelligibility only, and a transcript can't show it. */
  sound: boolean;
  /**
   * Only the candidate's voice shows it (pronunciation, DELE's "Fluidez"), so typed replies aren't
   * rated on it; DELE A1 and A2's "Uso de la lengua" covers words too, so it isn't.
   */
  voiceOnly: boolean;
  /**
   * Rated from how the candidate takes part in an exchange (Cambridge's Interactive Communication),
   * so a task they speak through alone gives no evidence for it.
   */
  interactive?: boolean;
};

/** One line of the official mark sheet: a criterion in a task (or the whole paper) and its points. */
export type SpeakingScoreRow = {
  criterion: string;
  /** Null for a criterion rated once for the whole paper. */
  task: string | null;
  /** The points each band gives, from band 0; half bands fall between. */
  points: readonly number[];
};

/**
 * The paper's own pass rule, in its terms: a minimum shared with another paper (DELE's group with
 * listening), a minimum of its own, a floor below which the whole exam fails (DELF), or none
 * (Cambridge reports one overall score).
 */
type SpeakingPassRule =
  | { kind: "group"; min: number; of: number }
  | { kind: "paper"; min: number }
  | { kind: "floor"; min: number }
  | { kind: "none" };

export type SpeakingFormat = {
  exam: SpeakingExam;
  level: CefrLevel;
  /** "DELE B2", "Goethe-Zertifikat B1", "B2 First". */
  title: string;
  /** The speaking paper's official name. */
  paper: string;
  /** The paper's official speaking time, in minutes. */
  minutes: { max: number; min: number };
  /** The preparation before the paper, in minutes, and the tasks it covers. */
  prepMinutes: number;
  prepTasks: readonly string[];
  tasks: readonly SpeakingTaskFormat[];
  criteria: readonly SpeakingCriterionFormat[];
  rows: readonly SpeakingScoreRow[];
  /** The paper's official maximum, which the rows add up to. */
  total: number;
  pass: SpeakingPassRule;
  source: string;
};

/** The points of a row that grows evenly with the band: `max` points at `maxBand`. */
export function evenPoints({ max, maxBand }: { max: number; maxBand: number }): number[] {
  return Array.from({ length: maxBand + 1 }, (_, band) => (band * max) / maxBand);
}

type TaskDefaults = "cues" | "options" | "prepMinutes";

/** A task with no cues, no choice of cards and no preparation unless it says otherwise. */
export function speakingTask(
  task: Omit<SpeakingTaskFormat, TaskDefaults> & Partial<Pick<SpeakingTaskFormat, TaskDefaults>>,
): SpeakingTaskFormat {
  return { cues: [], options: 1, prepMinutes: 0, ...task };
}
