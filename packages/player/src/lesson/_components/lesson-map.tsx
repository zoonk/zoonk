"use client";

import { type LessonMap as LessonMapData } from "@zoonk/core/library/lessons/map";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { LessonRichText } from "./lesson-rich-text";

type MapIdea = LessonMapData["ideas"][number];

const LABEL_CLASS = "text-foreground block text-[15px] leading-5 font-semibold tracking-tight";

const LEVEL_CLASSES = [
  "rounded-[14px] p-3",
  "rounded-[11px] p-[11px]",
  "rounded-[9px] p-2.5",
  "rounded-[7px] p-2.5",
] as const;

function MapIdeaText({ idea }: { idea: MapIdea }) {
  return (
    <>
      {idea.label && <span className={LABEL_CLASS}>{idea.label}</span>}
      <span
        className={cn(
          "block text-sm leading-5 text-pretty",
          idea.label ? "text-muted-foreground mt-0.5" : "text-foreground",
        )}
      >
        <LessonRichText text={idea.text} />
      </span>
    </>
  );
}

function HubMap({ ideas, title }: { ideas: readonly MapIdea[]; title: string }) {
  return (
    <div className="flex flex-col">
      <p className="bg-muted w-fit max-w-full rounded-[9px] px-[11px] py-1.5 text-[15px] leading-5 font-semibold tracking-tight text-balance">
        {title}
      </p>

      <ul className="-mt-1.5 flex flex-col pl-[26px]">
        {ideas.map((idea, index) => {
          const key = `idea-${index}`;

          return (
            <li
              className={cn(
                "relative pt-4",
                "before:border-input before:absolute before:top-[26px] before:-left-3.5 before:w-[9px] before:border-t before:content-['']",
                "after:border-input after:absolute after:top-0 after:-left-3.5 after:h-full after:border-l after:content-['']",
                "last:after:h-[26px]",
              )}
              key={key}
            >
              <MapIdeaText idea={idea} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NestedLevel({ ideas, index }: { ideas: readonly MapIdea[]; index: number }) {
  const idea = ideas[index];

  if (!idea) {
    return null;
  }

  const depth = ideas.length - 1 - index;
  const isInnermost = index === 0;

  return (
    <div
      className={cn(
        "flex flex-col",
        LEVEL_CLASSES[Math.min(depth, LEVEL_CLASSES.length - 1)],
        isInnermost ? "bg-muted" : "border-foreground/50 contrast-more:border-foreground border",
      )}
      data-slot="lesson-map-level"
    >
      {!isInnermost && (
        <div className="mb-2.5">
          <NestedLevel ideas={ideas} index={index - 1} />
        </div>
      )}
      <MapIdeaText idea={idea} />
    </div>
  );
}

function NestedMap({ ideas }: { ideas: readonly MapIdea[] }) {
  const t = useExtracted();

  return (
    <div>
      <p className="sr-only">
        {t({
          description:
            "Read by screen readers before a diagram of boxes inside boxes, the smallest first.",
          message: "Each level sits inside the next one.",
        })}
      </p>
      <NestedLevel ideas={ideas} index={ideas.length - 1} />
    </div>
  );
}

export function LessonMap({ map, title }: { map: LessonMapData; title: string }) {
  return (
    <div className="w-full" data-shape={map.shape} data-slot="lesson-map">
      {map.shape === "nested" ? (
        <NestedMap ideas={map.ideas} />
      ) : (
        <HubMap ideas={map.ideas} title={title} />
      )}
    </div>
  );
}
