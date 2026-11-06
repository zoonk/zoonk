"use client";

import { type LessonIcon } from "@zoonk/core/library/icons/contract";
import { type StepMarks } from "@zoonk/core/library/marks/contract";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { LessonIconImage } from "./lesson-icon";

type TextPart = { isExample: boolean; text: string };

/** Paragraphs as plain blocks, so their lines wrap around an icon floated on the corner. */
const FLOWING_TEXT_CLASS = "block space-y-3";

const NUMBERED_LINE = /^\s*\d{1,3}[.)]\s/u;

/** Framing part of a numbered list would split it, and each part would count from 1 again. */
function isInNumberedList({ end, start, text }: { end: number; start: number; text: string }) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = text.indexOf("\n", end);
  const lines = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).split("\n");
  return lines.some((line) => NUMBERED_LINE.test(line));
}

/** Where the example sits in the text, or null when the screen shows no frame. */
function findFramedExample({ marks, text }: { marks: StepMarks | null; text: string }) {
  const example = marks?.example;
  const start = example ? text.indexOf(example) : -1;

  return example && start !== -1 && !isInNumberedList({ end: start + example.length, start, text })
    ? { example, start }
    : null;
}

/** Without a frame, the screen's icon sits on the text's corner instead. */
export function hasExampleFrame({ marks, text }: { marks: StepMarks | null; text: string }) {
  return findFramedExample({ marks, text }) !== null;
}

/** Core keeps `example` an exact substring with balanced markup, so each part parses on its own. */
function splitAtExample({ marks, text }: { marks: StepMarks | null; text: string }): TextPart[] {
  const framed = findFramedExample({ marks, text });

  if (!framed) {
    return [{ isExample: false, text }];
  }

  const { example, start } = framed;

  return [
    { isExample: false, text: text.slice(0, start) },
    { isExample: true, text: example },
    { isExample: false, text: text.slice(start + example.length) },
  ].filter((part) => part.text.trim());
}

/** Core finds `underline` in the text with its bold marks removed, so it may run through a new term. */
function withoutBold(text: string): string {
  return text.replaceAll("**", "");
}

export function CornerIcon({ className, icon }: { className?: string; icon: LessonIcon }) {
  return (
    <LessonIconImage
      className={cn("relative float-end ms-3 size-16 sm:size-18", className)}
      icon={icon}
      size={72}
    />
  );
}

function ExampleBox({ children, icon }: { children: React.ReactNode; icon: LessonIcon | null }) {
  const t = useExtracted();

  return (
    <div
      className="before:border-foreground/40 contrast-more:before:border-foreground relative flow-root px-4 pt-5 pb-4 before:pointer-events-none before:absolute before:inset-0 before:rotate-[-0.6deg] before:rounded-[1.25rem_0.75rem_1.375rem_0.625rem/0.75rem_1.25rem_0.625rem_1.375rem] before:border-2 before:border-dashed first:mt-3"
      data-slot="example-box"
    >
      <span className="bg-background text-muted-foreground absolute inset-s-3 -top-2.5 px-1.5 text-sm leading-5 font-medium">
        {t({
          description:
            "Label on the dashed frame around the sentences of a lesson screen that give an example.",
          message: "Example",
        })}
      </span>
      {icon && <CornerIcon className="-me-6 -mt-9 mb-1" icon={icon} />}
      {children}
    </div>
  );
}

export function MarkedText({
  className,
  marks,
  text,
}: {
  className?: string;
  marks: StepMarks | null;
  text: string;
}) {
  const parts = splitAtExample({ marks, text });
  const underline = marks?.underline ?? null;

  const underlined = underline
    ? parts.findIndex((part) => withoutBold(part.text).includes(underline))
    : -1;

  const views = parts.map((part, index) => {
    const blocks = (
      <RichTextBlocks
        className={cn(className, FLOWING_TEXT_CLASS)}
        mark={index === underlined ? underline : null}
        markStyle="underline"
        text={part.text}
      />
    );

    const key = `part-${index}`;

    return part.isExample ? (
      <ExampleBox icon={marks?.icon ?? null} key={key}>
        {blocks}
      </ExampleBox>
    ) : (
      <Fragment key={key}>{blocks}</Fragment>
    );
  });

  return parts.some((part) => part.isExample) ? (
    <div className="flex flex-col gap-7">{views}</div>
  ) : (
    views
  );
}
