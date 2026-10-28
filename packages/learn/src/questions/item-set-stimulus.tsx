"use client";

import { type ItemSetView } from "@zoonk/core/library/items/set-view";
import { type ListeningSetView } from "@zoonk/core/library/listening/view";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import {
  type ListeningQuestions,
  ListeningStimulus,
  type ServedPlays,
} from "../listening/listening-stimulus";
import { LessonVisual } from "../visuals/lesson-visual";
import { ItemText } from "./item-text";

/** About eight lines at the narrowest width, which fits the folded height anyway. */
const FOLD_MIN_CHARACTERS = 400;

function SetPlace({ set }: { set: ItemSetView }) {
  const t = useExtracted();
  const place = { count: set.count, position: set.position + 1 };

  const label = {
    audio: t("Question {position, number} of {count, number} on this recording", place),
    case: t("Question {position, number} of {count, number} on this case", place),
    chart: t("Question {position, number} of {count, number} on this chart", place),
    text: t("Question {position, number} of {count, number} on this text", place),
  }[set.kind];

  return <p className="text-muted-foreground text-xs font-medium">{label}</p>;
}

type RecordingProps = {
  askedIn?: string | null;
  place?: boolean;
  practice?: boolean;
  questions?: ListeningQuestions | null;
  served?: ServedPlays | null;
  transcript?: ListeningSetView["transcript"];
};

function SetRecording({
  askedIn = null,
  listening,
  place = true,
  practice = false,
  questions = null,
  served = null,
  set,
  transcript = null,
}: RecordingProps & { listening: ListeningSetView; set: ItemSetView }) {
  const t = useExtracted();

  return (
    <section aria-label={set.title ?? t("Recording")} className="flex flex-col gap-3">
      {place && <SetPlace set={set} />}
      <ListeningStimulus
        playsKey={askedIn ? `${askedIn}:${set.id}` : set.id}
        practice={practice}
        questions={questions}
        served={served}
        set={transcript ? { ...listening, transcript } : listening}
      />
    </section>
  );
}

function SetText({ continued, set }: { continued: boolean; set: ItemSetView }) {
  const t = useExtracted();
  const textId = useId();
  const folds = continued && (set.text?.length ?? 0) >= FOLD_MIN_CHARACTERS;
  const [expanded, setExpanded] = useState(!folds);

  return (
    <section
      aria-label={set.title ?? t("Shared text")}
      className="border-border flex flex-col gap-3 border-l-2 pl-4 lg:group-data-aside/task:border-l-0 lg:group-data-aside/task:pl-0"
    >
      <SetPlace set={set} />
      {set.title && <h3 className="font-semibold">{set.title}</h3>}

      {set.text && (
        <div
          className={cn(
            "text-sm leading-relaxed",
            !expanded &&
              "max-h-24 overflow-hidden mask-b-from-40% lg:max-h-none lg:overflow-visible lg:mask-none",
          )}
          id={textId}
        >
          <ItemText text={set.text} />
        </div>
      )}

      {folds && (
        <Button
          aria-controls={textId}
          aria-expanded={expanded}
          className="self-start lg:hidden"
          onClick={() => setExpanded(!expanded)}
          size="sm"
          variant="outline"
        >
          {expanded ? t("Show less") : t("Read it all again")}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
          />
        </Button>
      )}

      <LessonVisual visual={set.visual} />
      {set.source && <p className="text-muted-foreground text-xs">{set.source}</p>}
    </section>
  );
}

export function ItemSetStimulus({
  continued = false,
  set,
  ...recording
}: RecordingProps & { continued?: boolean; set: ItemSetView }) {
  if (set.listening) {
    return <SetRecording {...recording} listening={set.listening} set={set} />;
  }

  return <SetText continued={continued} set={set} />;
}
