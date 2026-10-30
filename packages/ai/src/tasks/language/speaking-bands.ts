import { isJsonObject } from "@zoonk/utils/json";
import { type ConversationTurn } from "./_utils/conversation-transcript";

export type SpeakingScale = {
  /** When the scale doesn't start at 0 (TOEFL's 1). */
  minBand?: number;
  maxBand: number;
  halfBands: boolean;
};

export type SpeakingCriterion = SpeakingScale & {
  key: string;
  /** In the exam's language. */
  name: string;
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

type SpeakingCriterionGrade = BandRange & { criterion: string; evidence: string; tip: string };

export type SpeakingGrade = {
  /** The candidate said too little to judge well; the result says so once, not per criterion. */
  brief: boolean;
  criteria: SpeakingCriterionGrade[];
  focus: string;
  /** False when the candidate only typed: voice-only criteria then aren't rated. */
  heard: boolean;
};

/** About a fifth of a learner's usual pace over the task's shortest official time. */
const BRIEF_WORDS_PER_MINUTE = 25;

export function listRatedCriteria<Criterion extends Pick<SpeakingCriterion, "voiceOnly">>({
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

export function toBand({ scale, value }: { scale: SpeakingScale; value: number }): number {
  const step = scale.halfBands ? HALF : 1;
  const min = scale.minBand ?? 0;
  return Math.min(scale.maxBand, Math.max(min, Math.round(value / step) * step));
}

function centeredRange({
  center,
  scale,
  width,
}: {
  center: number;
  scale: SpeakingScale;
  width: number;
}): BandRange {
  const min = scale.minBand ?? 0;

  const bandLow = Math.min(
    scale.maxBand - width,
    Math.max(min, toBand({ scale, value: center - width / 2 })),
  );

  return { bandHigh: bandLow + width, bandLow };
}

/**
 * Learners see these numbers, so a reversed, off-scale or overly narrow range never reaches them.
 */
function normalizeBandRange({
  bandHigh,
  bandLow,
  criterion,
}: BandRange & { criterion: SpeakingCriterion }): BandRange {
  const low = toBand({ scale: criterion, value: Math.min(bandLow, bandHigh) });
  const high = toBand({ scale: criterion, value: Math.max(bandLow, bandHigh) });
  const center = (low + high) / 2;
  const span = criterion.maxBand - (criterion.minBand ?? 0);
  const minWidth = criterion.sound ? Math.min(SOUND_MIN_WIDTH, span) : 0;

  if (high - low > MAX_RANGE_WIDTH) {
    return centeredRange({ center, scale: criterion, width: MAX_RANGE_WIDTH });
  }

  if (high - low < minWidth) {
    return centeredRange({ center, scale: criterion, width: minWidth });
  }

  return { bandHigh: high, bandLow: low };
}

function countCandidateWords(turns: readonly ConversationTurn[]): number {
  return turns
    .filter((turn) => turn.speaker === "learner")
    .reduce((total, turn) => total + (turn.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0);
}

export function toSpeakingGrade({
  criteria,
  minMinutes,
  output,
  spokenSeconds,
  turns,
}: {
  criteria: readonly SpeakingCriterion[];
  minMinutes: number;
  output: Record<string, unknown> & { focus: string };
  spokenSeconds: number;
  turns: readonly ConversationTurn[];
}): SpeakingGrade {
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
        ...normalizeBandRange({ ...entry, criterion }),
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
