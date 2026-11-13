"use client";

import { LESSON_BODY_CLASS, RichTextBlocks } from "@zoonk/learn/rich-text";
import { RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useTermHighlighter } from "../_components/lesson-step-text";
import { MarkedText } from "../_components/marked-text";
import { NumberedLine } from "../_components/numbered-line";
import { type StepOf } from "./lesson-step-view-props";

type WorkedExampleContentData = StepOf<"workedExample">["content"];

function WorkedExampleLine({
  entering,
  number,
  step,
}: {
  entering: boolean;
  number: number;
  step: WorkedExampleContentData["steps"][number];
}) {
  return (
    <NumberedLine
      className={cn(entering && "animate-in fade-in slide-in-from-bottom-1 duration-base ease-out")}
      number={number}
    >
      <RichTextBlocks text={step.text} />
      {step.math && <RichInlineSegments segments={[{ kind: "displayMath", text: step.math }]} />}
    </NumberedLine>
  );
}

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

export function WorkedExampleContent({
  content,
  figure,
  marks,
  revealed,
}: {
  content: WorkedExampleContentData;
  figure?: React.ReactNode;
  marks: StepOf<"workedExample">["marks"];
  revealed: number;
}) {
  const t = useExtracted();
  const isDone = revealed >= content.steps.length;
  const endRef = useNewestStepInView(revealed);
  const highlighter = useTermHighlighter();
  // oxlint-disable-next-line react/hook-use-state -- Read once as the screen opens, never updated.
  const [openedWith] = useState(revealed);

  return (
    <div
      className={cn(highlighter, "flex w-full flex-col gap-5 lg:max-w-xl")}
      data-slot="worked-example"
    >
      <MarkedText className={LESSON_BODY_CLASS} marks={marks} text={content.problem} />
      {figure}

      <ol aria-label={t("Steps")} aria-live="polite" className="flex flex-col gap-3">
        {content.steps.slice(0, revealed).map((step, index) => {
          const key = `step-${index}`;

          return (
            <WorkedExampleLine
              entering={index >= openedWith}
              key={key}
              number={index + 1}
              step={step}
            />
          );
        })}
      </ol>

      {isDone && (
        <div className={cn(SURFACE_CLASS, "flex flex-col gap-1 p-4")}>
          <p className="text-muted-foreground text-sm font-medium">{t("Result")}</p>
          <RichTextBlocks className={LESSON_BODY_CLASS} text={content.result} />
        </div>
      )}

      <div aria-hidden="true" className="-mt-5 scroll-mb-24" ref={endRef} />
    </div>
  );
}
