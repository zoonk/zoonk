import { cn } from "@zoonk/ui/lib/utils";

const BAD_SCORE = 8;
const GOOD_SCORE = 9.2;

export function getScoreClassName(score: number): string {
  return cn({
    "text-destructive-text": score < BAD_SCORE,
    "text-success-text": score >= GOOD_SCORE,
    "text-warning-text": score >= BAD_SCORE && score < GOOD_SCORE,
  });
}
