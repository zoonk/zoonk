"use client";

import { useExtracted } from "next-intl";
import { PlayerContentFrame } from "../../components/step-layouts";
import { isLanguageStep } from "../_utils/lesson-steps";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { IdeaMiniMap } from "./idea-mini-map";
import { LessonIconImage } from "./lesson-icon";

/** The icon's room is kept before it's drawn, so a late icon doesn't move the screen under the strip. */
const ICON_SLOT_CLASS = "ms-auto hidden size-11 shrink-0 @[16rem]/strip:block";

export function OrientationStrip({ step }: { step: PlayableLibraryStep }) {
  const t = useExtracted();
  const { lesson } = useLessonPlayerConfig();
  const ideas = lesson.summary?.ideas ?? [];
  const index = isLanguageStep(step) ? null : (step.marks?.ideaIndex ?? null);
  const idea = index === null ? undefined : ideas[index];

  if (index === null || !idea) {
    return null;
  }

  return (
    <PlayerContentFrame className="pt-4">
      <div
        className="border-border @container/strip flex items-center gap-3 border-b pb-3"
        data-slot="orientation-strip"
      >
        <IdeaMiniMap count={ideas.length} current={index} />

        <div className="flex min-h-11 min-w-0 flex-col justify-center">
          <p className="text-muted-foreground font-mono text-xs text-balance tabular-nums">
            {t({
              description:
                "Above a lesson screen: which of the lesson map's ideas the screen teaches, such as 'Idea 2 of 4'.",
              message: "Idea {current} of {total}",
              values: { current: String(index + 1), total: String(ideas.length) },
            })}
          </p>
          {idea.label && (
            <p className="text-foreground text-base leading-snug font-semibold text-pretty wrap-break-word">
              {idea.label}
            </p>
          )}
        </div>

        {idea.icon ? (
          <LessonIconImage className={ICON_SLOT_CLASS} icon={idea.icon} size={44} />
        ) : (
          <span aria-hidden="true" className={ICON_SLOT_CLASS} />
        )}
      </div>
    </PlayerContentFrame>
  );
}
