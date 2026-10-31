import { cn } from "@zoonk/ui/lib/utils";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { getBandFill } from "./_utils/level-scale";

const PERCENT = 100;

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
