import { Meter, MeterFill, MeterPart, MeterParts } from "@zoonk/learn/meter";
import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";

/** A belt has ten levels, each a tick. */
const LEVELS_PER_BELT = 10;

/** The demos' learner: an orange belt at level 4, Energy at 60%. */
const DEMO_LEVEL = 4;
export const ENERGY_NOW = 60;
const PERCENT = 100;

/** The day's missions: one done, one just done from half way, one to go. */
const MISSION_FILLS = [1, 1, 0] as const;
const JUST_DONE = 1;
const JUST_DONE_FROM = 0.5;

/** "+27", as every reward amount reads. */
export function plus(value: number): string {
  return `+${value}`;
}

export function percent(value: number): string {
  return `${value}%`;
}

/** A beat of a moment's order, as the delay of what plays on it. */
export function beat(delayMs: number): React.CSSProperties {
  return { animationDelay: `${delayMs}ms` };
}

/** A new level's number on its belt's color, landing on the spring, as `ReachedMoment` draws it. */
export function LevelBadge({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "animate-settle flex size-10 shrink-0 items-center justify-center rounded-full text-base font-semibold tabular-nums ring-1 ring-black/10 ring-inset",
        beltColorClasses.orange,
        "text-black/80",
      )}
      style={beat(delayMs)}
    >
      {DEMO_LEVEL}
    </span>
  );
}

/** The belt's ten levels as a meter's parts, the new one filling over its track (`BeltTicks`). */
export function BeltTicks({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <MeterParts as="span">
      {Array.from({ length: LEVELS_PER_BELT }, (_, index) => {
        const fills = index === DEMO_LEVEL - 1;

        return (
          <MeterPart
            as="span"
            className={cn(
              index < DEMO_LEVEL && !fills && beltColorClasses.orange,
              fills && "relative overflow-hidden",
            )}
            // oxlint-disable-next-line react/no-array-index-key -- Ticks are the belt's levels, not items.
            key={index}
          >
            {fills && (
              <span
                className={cn("animate-fill absolute inset-0 origin-left", beltColorClasses.orange)}
                style={beat(delayMs)}
              />
            )}
          </MeterPart>
        );
      })}
    </MeterParts>
  );
}

/** Energy's meter where Energy is: a moment knows only where it is now, so it doesn't fill. */
export function EnergyMeter() {
  return (
    <Meter>
      <MeterFill className="bg-energy" share={ENERGY_NOW / PERCENT} />
    </Meter>
  );
}

/** The day's missions as one violet track, the mission just done filling from where it was. */
export function MissionsTrack({ delayMs = 0 }: { delayMs?: number }) {
  const fillFrom: CSSPropertiesWithVariables = { ...beat(delayMs), "--fill-from": JUST_DONE_FROM };

  return (
    <span aria-hidden="true" className="flex h-1.5 gap-0.5">
      {MISSION_FILLS.map((fill, index) => (
        <span
          className="bg-brain/15 dark:bg-brain/30 relative flex-1 overflow-hidden rounded-[3px]"
          // oxlint-disable-next-line react/no-array-index-key -- Segments are the day's missions.
          key={index}
        >
          <span
            className={cn(
              "bg-brain absolute inset-y-0 left-0 w-full",
              fill === 0 && "hidden",
              index === JUST_DONE && "animate-fill origin-left",
            )}
            style={index === JUST_DONE ? fillFrom : undefined}
          />
        </span>
      ))}
    </span>
  );
}
