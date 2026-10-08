"use client";

import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { RichInlineSegments } from "../../components/rich-inline-segments";
import { LessonRichText, LessonRichTextBlocks } from "../_components/lesson-rich-text";
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
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
      >
        {number}
      </span>
      {/* Full width on every step, so each formula centers on the same axis. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5 text-base leading-relaxed sm:text-lg">
        <LessonRichText text={step.text} />
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
    <div className="flex w-full flex-col gap-5" data-slot="worked-example">
      <LessonRichTextBlocks className="text-lg leading-relaxed sm:text-xl" text={content.problem} />
      {figure}

      <ol aria-label={t("Steps")} aria-live="polite" className="flex flex-col gap-3">
        {content.steps.slice(0, revealed).map((step, index) => {
          const key = `step-${index}`;

          return <WorkedExampleLine key={key} number={index + 1} step={step} />;
        })}
      </ol>

      {isDone && (
        <div className="border-success/40 bg-success/5 flex flex-col gap-1 rounded-2xl border p-4">
          <p className="text-success text-sm font-semibold">{t("Result")}</p>
          <p className="text-base leading-relaxed sm:text-lg">
            <LessonRichText text={content.result} />
          </p>
        </div>
      )}

      {/* Takes no room: the negative margin cancels the list gap before it. */}
      <div aria-hidden="true" className="-mt-5 scroll-mb-24" ref={endRef} />
    </div>
  );
}
