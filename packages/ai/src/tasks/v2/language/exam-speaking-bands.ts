import { isJsonObject } from "@zoonk/utils/json";
import { type ConversationTurn } from "./_utils/conversation-transcript";

/** A criterion an exam task is rated on, as core's format table gives it. */
export type ExamSpeakingCriterion = {
  key: string;
  /** The official name, in the exam's language. */
  name: string;
  /** Bands run from 0 to this one. */
  maxBand: number;
  halfBands: boolean;
  /** The band the scale writes for the exam's level, when it names one. */
  levelBand: number | null;
  /** How the candidate sounds: a transcript can't show it, so its range is wider. */
  sound: boolean;
  /**
   * Only the candidate's voice shows it (pronunciation, DELE's "Fluidez"), so typed replies can't
   * be rated on it. DELE A1 and A2's "Uso de la lengua" is about sound and words, so text shows part.
   */
  voiceOnly: boolean;
  /** Rated in each task, or once for the whole paper from every task. */
  scope: "task" | "test";
};

type BandRange = { bandHigh: number; bandLow: number };

type ExamSpeakingCriterionGrade = BandRange & { criterion: string; evidence: string; tip: string };

export type ExamSpeakingGrade = {
  /** The candidate said too little to judge well; the result says so once, not per criterion. */
  brief: boolean;
  criteria: ExamSpeakingCriterionGrade[];
  focus: string;
  /** The candidate spoke rather than only typed; without their voice, voice-only criteria aren't rated. */
  heard: boolean;
};

/**
 * Under this many words a minute of a task's shortest official time, about a fifth of a
 * learner's usual pace, the candidate said too little to judge well.
 */
const BRIEF_WORDS_PER_MINUTE = 25;

/**
 * The criteria a task can be rated on: all of them when the candidate spoke, and without the ones
 * only their voice shows when they typed their replies, since nobody heard them.
 */
export function listRatedCriteria<Criterion extends Pick<ExamSpeakingCriterion, "voiceOnly">>({
  criteria,
  spokenSeconds,
}: {
  criteria: readonly Criterion[];
  spokenSeconds: number;
}): Criterion[] {
  return spokenSeconds > 0 ? [...criteria] : criteria.filter((criterion) => !criterion.voiceOnly);
}

const HALF = 0.5;

/** A range wider than one band tells the learner nothing they can act on. */
const MAX_RANGE_WIDTH = 1;

/** A transcript shows words, not sounds, so the criterion about sound spans a full band. */
const SOUND_MIN_WIDTH = 1;

function getStep(criterion: ExamSpeakingCriterion): number {
  return criterion.halfBands ? HALF : 1;
}

function toBand({ criterion, value }: { criterion: ExamSpeakingCriterion; value: number }) {
  const step = getStep(criterion);
  return Math.min(criterion.maxBand, Math.max(0, Math.round(value / step) * step));
}

/** A range of `width` starting at the band nearest `center - width / 2`, kept on the scale. */
function centeredRange({
  center,
  criterion,
  width,
}: {
  center: number;
  criterion: ExamSpeakingCriterion;
  width: number;
}): BandRange {
  const bandLow = Math.min(
    criterion.maxBand - width,
    Math.max(0, toBand({ criterion, value: center - width / 2 })),
  );

  return { bandHigh: bandLow + width, bandLow };
}

/**
 * Keeps a criterion's estimated range on its official scale (DELE 0 to 3, Goethe 0 to 4 for E to
 * A, Cambridge 0 to 5 in half bands), low end first, at most one band wide, and a full band for the
 * criterion about sound. Models return numbers the learner sees, so a reversed, off-scale or
 * overly narrow range never reaches them.
 */
function normalizeExamBandRange({
  bandHigh,
  bandLow,
  criterion,
}: BandRange & { criterion: ExamSpeakingCriterion }): BandRange {
  const low = toBand({ criterion, value: Math.min(bandLow, bandHigh) });
  const high = toBand({ criterion, value: Math.max(bandLow, bandHigh) });
  const center = (low + high) / 2;
  const minWidth = criterion.sound ? Math.min(SOUND_MIN_WIDTH, criterion.maxBand) : 0;

  if (high - low > MAX_RANGE_WIDTH) {
    return centeredRange({ center, criterion, width: MAX_RANGE_WIDTH });
  }

  if (high - low < minWidth) {
    return centeredRange({ center, criterion, width: minWidth });
  }

  return { bandHigh: high, bandLow: low };
}

function countCandidateWords(turns: readonly ConversationTurn[]): number {
  return turns
    .filter((turn) => turn.speaker === "learner")
    .reduce((total, turn) => total + (turn.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0);
}

/**
 * The model's output, one entry per criterion key, made into the grade the learner sees, with what
 * it rests on: whether the candidate spoke (`heard`) and whether they said too little for the task
 * to judge well (`brief`, from the words they said against its shortest official time).
 */
export function toExamSpeakingGrade({
  criteria,
  minMinutes,
  output,
  spokenSeconds,
  turns,
}: {
  criteria: readonly ExamSpeakingCriterion[];
  minMinutes: number;
  output: Record<string, unknown> & { focus: string };
  spokenSeconds: number;
  turns: readonly ConversationTurn[];
}): ExamSpeakingGrade {
  const brief = countCandidateWords(turns) < minMinutes * BRIEF_WORDS_PER_MINUTE;

  const graded = criteria.flatMap((criterion) => {
    const entry = output[criterion.key];

    if (!isCriterionOutput(entry)) {
      return [];
    }

    return [
      {
        criterion: criterion.key,
        evidence: entry.evidence,
        tip: entry.tip,
        ...normalizeExamBandRange({ ...entry, criterion }),
      },
    ];
  });

  return { brief, criteria: graded, focus: output.focus, heard: spokenSeconds > 0 };
}

function isCriterionOutput(value: unknown): value is BandRange & { evidence: string; tip: string } {
  return (
    isJsonObject(value) &&
    typeof value.bandLow === "number" &&
    typeof value.bandHigh === "number" &&
    typeof value.evidence === "string" &&
    typeof value.tip === "string"
  );
}
