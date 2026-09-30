"use client";

import { splitExcerpt } from "@zoonk/core/library/activities/excerpt-passages";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenText, ScrollText } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";

type SourceComparisonProps = ActivityRendererProps<"sourceComparison">;
type Source = SourceComparisonProps["content"]["fields"]["sources"][number];
type PassageState = "correct" | "incorrect" | "missed" | "marked" | "unmarked";

const SOURCE_ICONS = [ScrollText, BookOpenText] as const;

function passageState({
  isChecked,
  isMarked,
  isTarget,
}: {
  isChecked: boolean;
  isMarked: boolean;
  isTarget: boolean;
}): PassageState {
  if (!isChecked) {
    return isMarked ? "marked" : "unmarked";
  }

  if (isTarget) {
    return isMarked ? "correct" : "missed";
  }

  return isMarked ? "incorrect" : "unmarked";
}

const PASSAGE_CLASS: Record<PassageState, string> = {
  correct: "bg-success/15 text-foreground",
  incorrect: "bg-destructive/15 text-foreground",
  marked: "bg-viz-highlight-soft text-foreground",
  missed: "decoration-success underline decoration-2 decoration-dashed underline-offset-4",
  unmarked:
    "decoration-viz-accent/60 hover:bg-accent underline decoration-dotted decoration-2 underline-offset-4",
};

/** A passage the learner can mark: a checkbox inside the text, so it wraps like the sentence. */
function Passage({
  disabled,
  onToggle,
  state,
  text,
}: {
  disabled: boolean;
  onToggle: () => void;
  state: PassageState;
  text: string;
}) {
  const isChecked = state === "marked" || state === "correct" || state === "incorrect";

  return (
    <span
      aria-checked={isChecked}
      aria-disabled={disabled || undefined}
      className={cn(
        "focus-visible:ring-ring/50 rounded-sm [box-decoration-break:clone] px-0.5 py-0.5 outline-none focus-visible:ring-[3px] motion-safe:transition-colors",
        !disabled && "cursor-pointer",
        PASSAGE_CLASS[state],
      )}
      data-slot="source-passage"
      onClick={disabled ? undefined : onToggle}
      onKeyDown={(event) => {
        if (!disabled && (event.key === " " || event.key === "Enter")) {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }
      }}
      role="checkbox"
      tabIndex={disabled ? -1 : 0}
    >
      {text}
    </span>
  );
}

function SourceCard({
  index,
  isChecked,
  marked,
  onToggle,
  source,
}: {
  index: number;
  isChecked: boolean;
  marked: readonly string[];
  onToggle: (id: string) => void;
  source: Source;
}) {
  const Icon = SOURCE_ICONS[index % SOURCE_ICONS.length] ?? ScrollText;
  const { publisher, title, url, year } = source.citation;

  const details = [title, publisher, year === undefined ? null : String(year)]
    .filter(Boolean)
    .join(", ");

  return (
    <article
      aria-label={source.author}
      className="bg-background flex flex-col gap-2 rounded-2xl border p-3.5"
    >
      <header className="flex items-center gap-2.5">
        <span className="bg-viz-accent-soft text-viz-accent flex size-8 shrink-0 items-center justify-center rounded-full">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col leading-tight">
          <p className="text-sm font-semibold">{source.author}</p>
          <p className="text-muted-foreground text-xs">{source.date}</p>
        </div>
      </header>

      <blockquote className="font-serif text-[15px] leading-8">
        {splitExcerpt(source.excerpt, source.passages).map((segment, segmentIndex) => {
          const passage = source.passages.find((item) => item.id === segment.passageId);

          return passage ? (
            <Passage
              disabled={isChecked}
              key={passage.id}
              onToggle={() => onToggle(passage.id)}
              state={passageState({
                isChecked,
                isMarked: marked.includes(passage.id),
                isTarget: passage.isTarget,
              })}
              text={segment.text}
            />
          ) : (
            // oxlint-disable-next-line react/no-array-index-key -- Plain text between passages has no id
            <span key={segmentIndex}>{segment.text}</span>
          );
        })}
      </blockquote>

      <p className="text-muted-foreground text-xs">
        {url ? (
          <a className="underline underline-offset-2" href={url} rel="noreferrer" target="_blank">
            {details}
          </a>
        ) : (
          details
        )}
      </p>
    </article>
  );
}

/**
 * Two eyewitness sources side by side, to see how who wrote a source shapes what it says. The
 * learner marks passages in each; with a selection check the marked passages are the answer and
 * the check shows which ones the question was about.
 */
export function SourceComparisonActivity({
  content,
  labelId,
  onAnswerChange,
  phase,
}: SourceComparisonProps) {
  const t = useExtracted();
  const { check, fields } = content;
  const [marked, setMarked] = useState<string[]>([]);
  const isChecked = phase === "checked";

  function toggle(id: string) {
    const next = marked.includes(id) ? marked.filter((item) => item !== id) : [...marked, id];
    setMarked(next);

    if (check.kind === "interaction") {
      onAnswerChange(next.length > 0 ? { ids: next, kind: "selection" } : null);
    }
  }

  const markedTexts = fields.sources
    .flatMap((source) => source.passages)
    .filter((passage) => marked.includes(passage.id))
    .map((passage) => passage.text);

  return (
    <ActivityCanvas labelId={labelId}>
      <ActivityCanvasLabel className="text-foreground text-sm font-medium">
        {fields.markPrompt}
      </ActivityCanvasLabel>

      <div className="flex flex-col gap-2">
        {fields.sources.map((source, index) => (
          <SourceCard
            index={index}
            isChecked={isChecked}
            key={source.id}
            marked={marked}
            onToggle={toggle}
            source={source}
          />
        ))}
      </div>

      {isChecked && (
        <div
          aria-hidden="true"
          className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
        >
          <span className="flex items-center gap-1.5">
            <span className="bg-success/25 h-3 w-4 rounded-sm" />
            {t("What to mark")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="border-success w-4 border-b-2 border-dashed" />
            {t("Missed")}
          </span>
        </div>
      )}

      <ActivityTextAlternative>
        {t("Two sources to compare: {first} and {second}.", {
          first: `${fields.sources[0]?.author ?? ""}, ${fields.sources[0]?.date ?? ""}`,
          second: `${fields.sources[1]?.author ?? ""}, ${fields.sources[1]?.date ?? ""}`,
        })}{" "}
        {markedTexts.length > 0
          ? t("You marked: {passages}.", { passages: markedTexts.join("; ") })
          : t("Nothing marked yet.")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
