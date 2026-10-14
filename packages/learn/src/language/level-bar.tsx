import { cn } from "@zoonk/ui/lib/utils";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { getBandFill } from "./_utils/level-scale";

const PERCENT = 100;

/**
 * A level on the A1 to C2 scale as six segments, one per band, filled in up to it: "B1" fills half
 * of B1's segment and "B1+" all of it. Drawn as every segmented bar is (4px, 3px gaps, 2px
 * corners). It sits beside the level's label, so it's hidden from screen readers.
 */
export function LevelBar({ className, score }: { className?: string; score: number }) {
  return (
    <span aria-hidden="true" className={cn("flex h-1 gap-0.75", className)} data-slot="level-bar">
      {CEFR_LEVELS.map((band, index) => (
        <span className="bg-surface-3 flex-1 overflow-hidden rounded-[2px]" key={band}>
          <span
            className="bg-success block h-full"
            style={{ width: `${getBandFill({ band: index, score }) * PERCENT}%` }}
          />
        </span>
      ))}
    </span>
  );
}
