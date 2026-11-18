import { toWords } from "@/lib/format";
import { type MasteryState } from "@zoonk/db/enums";
import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";

/** How far a skill is, weakest first: one blue that deepens as the skill settles. */
const MASTERY: { fill: string; state: MasteryState }[] = [
  { fill: "bg-surface-3", state: "new" },
  { fill: "bg-success/30", state: "learning" },
  { fill: "bg-success/60", state: "solid" },
  { fill: "bg-success", state: "mastered" },
];

export type MasteryCount = { count: number; state: MasteryState };

const SWATCH_CLASS = "size-2.5 shrink-0 rounded-xs";

function fillOf(state: MasteryState): string {
  return MASTERY.find((row) => row.state === state)?.fill ?? "";
}

/** One skill's state, with its swatch from the meter's key, so a row and the key read alike. */
export function MasteryMark({ state }: { state: MasteryState }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className={`${SWATCH_CLASS} ${fillOf(state)}`} />
      {toWords(state)}
    </span>
  );
}

/**
 * A set of skills, or of learners on one skill, at a glance: a part per state, sized by how many
 * are in it, then its key.
 */
export function MasteryMeter({ states }: { states: MasteryCount[] }) {
  const parts = MASTERY.flatMap(({ fill, state }) => {
    const count = states.find((row) => row.state === state)?.count ?? 0;
    return count > 0 ? [{ count, fill, state }] : [];
  });

  return (
    <div className="flex flex-col gap-2.5">
      <MeterParts>
        {parts.map((part) => (
          <MeterPart className={part.fill} key={part.state} weight={part.count} />
        ))}
      </MeterParts>
      <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {parts.map((part) => (
          <li className="flex items-center gap-1.5" key={part.state}>
            <span aria-hidden="true" className={`${SWATCH_CLASS} ${part.fill}`} />
            {toWords(part.state)}
            <span className="text-foreground font-mono tabular-nums">
              {part.count.toLocaleString("en")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
