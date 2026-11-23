import { cn } from "@zoonk/ui/lib/utils";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { getBandFill } from "./_utils/level-scale";

const PERCENT = 100;

type LevelBarValue =
  | { range?: never; score: number }
  /** The bands a skill's level lies within, lowest to highest, as indexes of `CEFR_LEVELS`. */
  | { range: { high: number; low: number }; score?: never };

function getFill({ band, range, score }: LevelBarValue & { band: number }): number {
  if (range) {
    return band >= range.low && band <= range.high ? 1 : 0;
  }

  return getBandFill({ band, score });
}

export function LevelBar({ className, ...value }: LevelBarValue & { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-1 gap-0.75", className)} data-slot="level-bar">
      {CEFR_LEVELS.map((band, index) => (
        <span className="bg-surface-3 flex-1 overflow-hidden rounded-xs" key={band}>
          <span
            className="bg-success block h-full"
            style={{ width: `${getFill({ ...value, band: index }) * PERCENT}%` }}
          />
        </span>
      ))}
    </span>
  );
}
