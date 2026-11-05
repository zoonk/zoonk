"use client";

import { type LessonMap as LessonMapData } from "@zoonk/core/library/lessons/map";
import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { type IdeaSlot, getIdeaSlots, getSlotRows } from "../_utils/idea-slots";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { LessonIconImage } from "./lesson-icon";
import { LessonRichText } from "./lesson-rich-text";

type MapIdea = LessonMapData["ideas"][number];

/** While icons are on their way, an idea keeps its icon's room, so a late icon doesn't move its words. */
const ICON_SLOT_CLASS = "-ms-1 size-9 shrink-0";

function IdeaContent({ idea, number }: { idea: MapIdea; number: number }) {
  const { lesson } = useLessonPlayerConfig();

  return (
    <>
      <span className="flex min-h-9 items-center gap-2">
        {idea.icon ? (
          <LessonIconImage className={ICON_SLOT_CLASS} icon={idea.icon} size={36} />
        ) : (
          lesson.marksPending && <span aria-hidden="true" className={ICON_SLOT_CLASS} />
        )}
        <span className="flex min-w-0 flex-col">
          <span aria-hidden="true" className="text-faint font-mono text-xs tabular-nums">
            {number}
          </span>
          {idea.label && (
            <span className="text-foreground text-sm leading-tight font-semibold tracking-tight text-balance wrap-break-word hyphens-auto">
              {idea.label}
            </span>
          )}
        </span>
      </span>
      <span
        className={cn(
          "mt-1.5 block text-sm leading-snug text-pretty",
          idea.label ? "text-muted-foreground" : "text-foreground",
        )}
      >
        <LessonRichText text={idea.text} />
      </span>
    </>
  );
}

type Point = { x: number; y: number };

function centerIn({ box, rect }: { box: DOMRect; rect: DOMRect }): Point {
  return { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top };
}

function branchPath({ from, to }: { from: Point; to: Point }): string {
  const middle = (from.y + to.y) / 2;
  return `M${from.x} ${from.y}C${from.x} ${middle} ${to.x} ${middle} ${to.x} ${to.y}`;
}

function readBranchPaths(root: HTMLElement): string[] {
  const box = root.getBoundingClientRect();
  const hub = root.querySelector("[data-slot=lesson-map-center]");

  if (!hub) {
    return [];
  }

  const from = centerIn({ box, rect: hub.getBoundingClientRect() });

  return [...root.querySelectorAll("[data-slot=lesson-map-idea]")].map((idea) =>
    branchPath({ from, to: centerIn({ box, rect: idea.getBoundingClientRect() }) }),
  );
}

/** A line from the center to each idea, drawn behind them, measured from where the layout put them. */
function useBranchPaths() {
  const ref = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);

  useLayoutEffect(() => {
    const root = ref.current;

    if (!root) {
      return;
    }

    const draw = () => setPaths(readBranchPaths(root));
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  return { paths, ref };
}

function slotPlacement({
  first,
  slot,
}: {
  first: number;
  slot: IdeaSlot;
}): CSSPropertiesWithVariables {
  const columns = { "-1": "1", "0": "1 / span 2", "1": "2" } as const;
  return { "--map-column": columns[slot.column], "--map-row": slot.row - first + 1 };
}

function MindMap({ ideas, title }: { ideas: readonly MapIdea[]; title: string }) {
  const { paths, ref } = useBranchPaths();
  const slots = getIdeaSlots(ideas.length);
  const { first } = getSlotRows(slots);

  return (
    <div className="@container/lesson-map relative" ref={ref}>
      <svg
        aria-hidden="true"
        className="text-input contrast-more:text-foreground pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        {paths.map((path, index) => {
          const key = `branch-${index}`;
          return <path d={path} fill="none" key={key} stroke="currentColor" strokeWidth={1.5} />;
        })}
      </svg>

      <div className="relative grid grid-cols-1 gap-x-3 gap-y-5 @[22rem]/lesson-map:grid-cols-2 @[22rem]/lesson-map:gap-y-7">
        <p
          className="bg-muted relative w-fit max-w-64 justify-self-center rounded-[9px] px-3 py-2 text-center text-[15px] leading-5 font-semibold tracking-tight text-balance @[22rem]/lesson-map:col-span-2 @[22rem]/lesson-map:row-(--map-row)"
          data-slot="lesson-map-center"
          style={{ "--map-row": 1 - first } as CSSPropertiesWithVariables}
        >
          {title}
        </p>

        <ol className="contents">
          {ideas.map((idea, index) => {
            const slot = slots[index];
            const key = `idea-${index}`;

            return (
              slot && (
                <li
                  className={cn(
                    "bg-card ring-border relative flex flex-col rounded-xl p-3 ring-1",
                    "@[22rem]/lesson-map:col-(--map-column) @[22rem]/lesson-map:row-(--map-row)",
                    slot.column === 0 &&
                      "@[22rem]/lesson-map:w-[calc((100%-0.75rem)/2)] @[22rem]/lesson-map:justify-self-center",
                  )}
                  data-slot="lesson-map-idea"
                  key={key}
                  style={slotPlacement({ first, slot })}
                >
                  <IdeaContent idea={idea} number={index + 1} />
                </li>
              )
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function NestingNote() {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground mt-4 text-center text-sm">
      {t({
        description:
          "Under a lesson map whose ideas are levels, the smallest first, such as an organism inside a population.",
        message: "Each level sits inside the next one.",
      })}
    </p>
  );
}

export function LessonMap({ map, title }: { map: LessonMapData; title: string }) {
  return (
    <div className="w-full" data-shape={map.shape} data-slot="lesson-map">
      <MindMap ideas={map.ideas} title={title} />
      {map.shape === "nested" && <NestingNote />}
    </div>
  );
}
