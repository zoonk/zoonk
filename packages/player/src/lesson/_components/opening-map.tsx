"use client";

import { type LessonMap } from "@zoonk/core/library/lessons/map";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { useExtracted } from "next-intl";
import { type IdeaSlot, getIdeaSlots, getSlotRows } from "../_utils/idea-slots";
import { LessonIconImage } from "./lesson-icon";

type MapIdea = LessonMap["ideas"][number];

const COLUMN_GAP = 92;
const ROW_GAP = 80;
const NODE = 64;

type Point = { x: number; y: number };

function toPercent({ point, size }: { point: Point; size: Point }) {
  return {
    left: `${String((point.x / size.x) * 100)}%`,
    top: `${String((point.y / size.y) * 100)}%`,
  };
}

function OpeningMapIdea({
  about,
  idea,
  number,
  position,
  total,
}: {
  about: string;
  idea: MapIdea;
  number: number;
  position: React.CSSProperties;
  total: number;
}) {
  const t = useExtracted();

  const ideaOfTotal = t({
    description:
      "Above a lesson screen: which of the lesson map's ideas the screen teaches, such as 'Idea 2 of 4'.",
    message: "Idea {current} of {total}",
    values: { current: String(number), total: String(total) },
  });

  return (
    <Popover>
      <PopoverTrigger
        aria-label={ideaOfTotal}
        className="bg-background border-input hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-ring/50 data-popup-open:bg-selected-tint contrast-more:border-foreground contrast-more:data-popup-open:border-foreground absolute grid size-16 -translate-1/2 place-items-center rounded-full border-2 border-dashed transition-colors outline-none focus-visible:ring-[3px] data-popup-open:border-transparent"
        data-slot="opening-map-idea"
        style={position}
      >
        {idea.icon ? (
          <LessonIconImage className="size-11" icon={idea.icon} size={44} />
        ) : (
          <span aria-hidden="true" className="text-muted-foreground font-mono text-lg tabular-nums">
            {number}
          </span>
        )}
        {idea.icon && (
          <span
            aria-hidden="true"
            className="bg-muted text-muted-foreground absolute -inset-s-1 -top-1 grid size-6 place-items-center rounded-full font-mono text-xs tabular-nums"
          >
            {number}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent backdrop={false} className="w-64 max-w-(--available-width)">
        <PopoverHeader>
          <PopoverTitle className="text-pretty wrap-break-word">
            {idea.label ?? ideaOfTotal}
          </PopoverTitle>
          <PopoverDescription className="leading-snug text-pretty">{about}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

function toPoint({ center, slot }: { center: Point; slot: IdeaSlot }): Point {
  return { x: center.x + slot.column * COLUMN_GAP, y: center.y + slot.row * ROW_GAP };
}

/** Shown only once tagging wrote every idea's `about` line, which says what it covers without its answer. */
export function OpeningMap({ ideas }: { ideas: readonly MapIdea[] }) {
  const t = useExtracted();
  const abouts = ideas.map((idea) => idea.about);

  if (abouts.some((about) => !about)) {
    return null;
  }

  const slots = getIdeaSlots(ideas.length);
  const rows = getSlotRows(slots);
  const size = { x: COLUMN_GAP * 2 + NODE, y: (rows.last - rows.first) * ROW_GAP + NODE };
  const center = { x: size.x / 2, y: -rows.first * ROW_GAP + NODE / 2 };
  const points = slots.map((slot) => toPoint({ center, slot }));

  return (
    <figure
      className="flex w-full flex-col items-center gap-4 pt-2 sm:my-auto lg:pt-8"
      data-slot="opening-map"
    >
      <div
        className="relative w-full"
        style={{ aspectRatio: `${String(size.x)} / ${String(size.y)}`, maxWidth: size.x }}
      >
        <svg
          aria-hidden="true"
          className="text-input contrast-more:text-foreground absolute inset-0 size-full"
          viewBox={`0 0 ${String(size.x)} ${String(size.y)}`}
        >
          {points.map((point, index) => {
            const key = `line-${index}`;

            return (
              <line
                key={key}
                stroke="currentColor"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                x1={center.x}
                x2={point.x}
                y1={center.y}
                y2={point.y}
              />
            );
          })}
        </svg>

        <span
          aria-hidden="true"
          className="bg-foreground/20 contrast-more:bg-foreground absolute size-2.5 -translate-1/2 rounded-full"
          style={toPercent({ point: center, size })}
        />

        {ideas.map((idea, index) => {
          const point = points[index];
          const about = abouts[index];

          return (
            point &&
            about && (
              <OpeningMapIdea
                about={about}
                idea={idea}
                key={idea.text}
                number={index + 1}
                position={toPercent({ point, size })}
                total={ideas.length}
              />
            )
          );
        })}
      </div>

      <figcaption className="flex flex-col items-center gap-0.5 text-center text-sm">
        <span className="text-foreground font-medium">
          {t({
            description:
              "Under the lesson map on a lesson's opening screen: says the ideas drawn above are what this lesson will teach.",
            message: "What you'll learn in this lesson",
          })}
        </span>
        <span className="text-muted-foreground">
          {t({
            description:
              "Under the lesson map on a lesson's opening screen. Tapping one of its ideas shows its name and what it covers.",
            message: "Tap an idea to see what it covers",
          })}
        </span>
      </figcaption>
    </figure>
  );
}
