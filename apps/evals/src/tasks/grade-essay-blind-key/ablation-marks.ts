import { type Ablation, getAblationSource } from "./ablations";

export const ABLATION_READERS_FILE = "eval-results/blind-keys/ablation-readers.json";

/** One reader from each family scores the edits blind against the official key. */
export const ABLATION_READERS = ["anthropic/claude-sonnet-5.5", "openai/gpt-6.1-sol"] as const;

export type ReaderMark = { id: string; model: string; mark: number; earned: number[] };

export type AblationReaderFile = {
  generatedAt: string;
  readers: string[];
  system: string;
  spentUsd: number;
  marks: ReaderMark[];
};

export type MarkRange = { low: number; high: number };

/**
 * A clean edit keeps the espelho's arithmetic. An ambiguous one keeps the range its two readers
 * span, held inside the espelho's bounds; readers who both fall outside give the bounds.
 */
export function getAblationMark(ablation: Ablation, marks: ReaderMark[]): MarkRange {
  const { espelho } = getAblationSource(ablation);

  if (ablation.dependent.length === 0) {
    return espelho;
  }

  const read = marks.filter(({ id }) => id === ablation.id).map(({ mark }) => mark);
  const clamp = (mark: number) => Math.min(espelho.high, Math.max(espelho.low, mark));

  if (read.length === 0) {
    return espelho;
  }

  return { high: clamp(Math.max(...read)), low: clamp(Math.min(...read)) };
}
