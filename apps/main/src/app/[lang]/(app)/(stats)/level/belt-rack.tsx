import { type BeltColorOption } from "@/lib/belt-colors";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { getExtracted } from "next-intl/server";

function RackBelt({ color, isTied }: { color: BeltColor; isTied: boolean }) {
  const shapes = isTied ? (
    <>
      <polygon points="18.6,12.5 22.4,12.5 16.6,27.6 12.2,27.6" />
      <polygon points="21.6,12.5 25.4,12.5 31.8,27.6 27.4,27.6" />
      <rect height="8" rx="2" width="41" x="1.5" y="6" />
      <rect height="13" rx="3" width="10" x="17" y="3.5" />
    </>
  ) : (
    <>
      <rect height="7" rx="2" width="34" x="5" y="7.5" />
      <rect height="7" rx="2" width="34" x="5" y="15.5" />
      <rect height="15" rx="2" width="8" x="31" y="7.5" />
    </>
  );

  return (
    <svg aria-hidden="true" className="size-4/5" fill="currentColor" viewBox="0 0 44 30">
      {(color === "white" || color === "black") && (
        <g
          className={
            color === "white"
              ? "stroke-foreground/50 dark:stroke-none"
              : "stroke-none dark:stroke-white/50"
          }
          fill="none"
          strokeLinejoin="round"
          strokeWidth={3}
        >
          {shapes}
        </g>
      )}

      <g className={cn(color === "black" && "dark:fill-black")}>{shapes}</g>
    </svg>
  );
}

export async function BeltRack({
  beltColors,
  currentIndex,
  labelledBy,
}: {
  beltColors: BeltColorOption[];
  currentIndex: number;
  labelledBy: string;
}) {
  const t = await getExtracted();
  const firstBelt = beltColors[0];
  const lastBelt = beltColors.at(-1);

  const shortName = (color: BeltColor) =>
    t(
      "{color, select, white {White} yellow {Yellow} orange {Orange} green {Green} blue {Blue} purple {Purple} brown {Brown} red {Red} gray {Gray} black {Black} other {Belt}}",
      { color },
    );

  return (
    <div className="flex flex-col gap-2">
      <ol aria-labelledby={labelledBy} className="flex">
        {beltColors.map((belt, index) => (
          <li
            aria-current={index === currentIndex ? "step" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            key={belt.key}
          >
            <span
              aria-label={belt.label}
              className={cn(
                "flex h-6.5 w-8 items-center justify-center rounded-md md:h-9.5 md:w-13 md:rounded-lg",
                index === currentIndex && "ring-foreground ring-[1.5px]",
              )}
              role="img"
              style={{ color: `var(--belt-${belt.key})` }}
            >
              <RackBelt color={belt.key} isTied={index <= currentIndex} />
            </span>

            <span
              aria-hidden="true"
              className={cn(
                "hidden max-w-full truncate text-[0.71875rem] md:block",
                index === currentIndex && "text-foreground font-medium",
                index < currentIndex && "text-muted-foreground",
                index > currentIndex && "text-faint",
              )}
            >
              {shortName(belt.key)}
            </span>
          </li>
        ))}
      </ol>

      {firstBelt && lastBelt && (
        <div
          aria-hidden="true"
          className="text-faint flex justify-between text-[0.71875rem] md:hidden"
        >
          <span>{firstBelt.label}</span>
          <span>{lastBelt.label}</span>
        </div>
      )}
    </div>
  );
}
