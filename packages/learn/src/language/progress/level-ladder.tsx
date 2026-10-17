import { cn } from "@zoonk/ui/lib/utils";
import { CEFR_LEVELS, MAX_CEFR_SCORE, parseCefrScore } from "@zoonk/utils/cefr";
import { ProgressCell } from "../../_components/progress-cells";

const HALF_STEPS_PER_LEVEL = 2;

/**
 * A language goal's level on the CEFR scale, A1 to C2: each level's two half steps as cells (C2
 * has one), the steps reached in green and the ones up to the level the learner aims for outlined,
 * each level's name under its cells. Decoration: the level's words ("A2+ → B1+") are beside it.
 * Nothing for a label off the scale.
 */
export function LevelLadder({
  className,
  label,
  target,
}: {
  className?: string;
  label: string;
  target: string | null;
}) {
  const level = parseCefrScore(label);

  if (level === null) {
    return null;
  }

  const reached = level * HALF_STEPS_PER_LEVEL;
  const aim = (parseCefrScore(target) ?? 0) * HALF_STEPS_PER_LEVEL;

  return (
    <span aria-hidden="true" className={cn("flex gap-1", className)} data-slot="level-ladder">
      {CEFR_LEVELS.map((band, index) => {
        const first = index * HALF_STEPS_PER_LEVEL;
        const steps = index === MAX_CEFR_SCORE ? [first] : [first, first + 1];

        return (
          <span
            className="flex min-w-0 basis-0 flex-col gap-1.5"
            key={band}
            style={{ flexGrow: steps.length }}
          >
            <span className="flex gap-0.5">
              {steps.map((step) => (
                <ProgressCell
                  key={step}
                  planned={step > reached && step <= aim}
                  studied={step <= reached ? 1 : 0}
                />
              ))}
            </span>
            <span className="text-faint font-mono text-[0.6875rem] leading-none">{band}</span>
          </span>
        );
      })}
    </span>
  );
}
