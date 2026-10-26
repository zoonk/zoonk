"use client";

import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { type StepOf } from "./lesson-step-view-props";

type WorkedExampleContentData = StepOf<"workedExample">["content"];

function WorkedExampleLine({
  number,
  step,
}: {
  number: number;
  step: WorkedExampleContentData["steps"][number];
}) {
  return (
    <li className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 flex gap-3">
      {/* A step's number in the mono face, as the recap beside a question numbers it. */}
      <span
        aria-hidden="true"
        className="text-muted-foreground w-4 shrink-0 pt-0.5 font-mono text-sm leading-relaxed tabular-nums sm:text-base"
      >
        {number}
      </span>
      {/* Full width on every step, so each formula centers on the same axis. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5 text-base leading-relaxed sm:text-lg">
        <RichTextBlocks text={step.text} />
        {step.math && <RichInlineSegments segments={[{ kind: "displayMath", text: step.math }]} />}
      </div>
    </li>
  );
}

/**
 * Keeps the newest step in view when "Show the next step" adds one under the last, clear of the
 * action bar. Opening the screen or going back to it doesn't scroll.
 */
function useNewestStepInView(revealed: number) {
  const endRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(revealed);

  useEffect(() => {
    const isNewStep = revealed > shownRef.current;
    shownRef.current = revealed;

    if (!isNewStep) {
      return;
    }

    endRef.current?.scrollIntoView({ behavior: getScrollBehavior(), block: "nearest" });
  }, [revealed]);

  return endRef;
}

/**
 * A solved problem shown `revealed` steps at a time, so the learner follows how an expert thinks
 * one move after another. New steps are announced as they appear. Its `figure` (a picture, a chart
 * or a timeline) sits under the problem it belongs to, before the steps.
 */
export function WorkedExampleContent({
  content,
  figure,
  revealed,
}: {
  content: WorkedExampleContentData;
  figure?: React.ReactNode;
  revealed: number;
}) {
  const t = useExtracted();
  const isDone = revealed >= content.steps.length;
  const endRef = useNewestStepInView(revealed);

  return (
    <div className="flex w-full flex-col gap-5 lg:max-w-xl" data-slot="worked-example">
      <RichTextBlocks
        className="text-lg leading-relaxed md:text-[1.1875rem] md:leading-[1.6]"
        text={content.problem}
      />
      {figure}

      <ol aria-label={t("Steps")} aria-live="polite" className="flex flex-col gap-3">
        {content.steps.slice(0, revealed).map((step, index) => {
          const key = `step-${index}`;

          return <WorkedExampleLine key={key} number={index + 1} step={step} />;
        })}
      </ol>

      {/* The example's answer on a quiet panel: blue and red only say right and wrong. */}
      {isDone && (
        <div className={cn(SURFACE_CLASS, "flex flex-col gap-1 p-4")}>
          <p className="text-muted-foreground text-sm font-medium">{t("Result")}</p>
          <RichTextBlocks className="text-base leading-relaxed sm:text-lg" text={content.result} />
        </div>
      )}

      {/* Takes no room: the negative margin cancels the list gap before it. */}
      <div aria-hidden="true" className="-mt-5 scroll-mb-24" ref={endRef} />
    </div>
  );
}
