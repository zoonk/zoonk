import { type Ablation, getAblationSource } from "./ablations";

export const ABLATION_READERS_FILE = "eval-results/blind-keys/ablation-readers.json";

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
