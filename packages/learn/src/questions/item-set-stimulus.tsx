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

/**
 * A text shorter than this fits in the folded height on a phone anyway, so it never folds: about
 * eight lines at the narrowest width.
 */
const FOLD_MIN_CHARACTERS = 400;

/** Where the question sits among the questions that share the stimulus. */
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

/** How a recording is asked: where its plays count, and whether practice's restart applies. */
type RecordingProps = {
  /**
   * The block or mock a recording is asked in: its plays count there, so the same recording asked
   * again later (a mistake's drill, a mock) starts with every play.
   */
  askedIn?: string | null;
  /**
   * Says which of the recording's questions this is; off where the recording plays once above all
   * of them, as in a challenge's review.
   */
  place?: boolean;
  /**
   * A recording asked in practice gives back a play cut off by a reload or the app going to the
   * background, once; anywhere else (a mock) every play counts, as in the exam.
   */
  practice?: boolean;
  /** A recording's questions, to read before it plays. */
  questions?: ListeningQuestions | null;
  /** A mock's plays of the recording, kept on the server (see `ServedPlays`). */
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
      className="bg-muted/50 flex flex-col gap-3 rounded-2xl p-4"
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

/**
 * The text, case, chart or recording a set's questions share, above each of them. A text shows
 * whole, except a long one on a phone or tablet right after another question on it (`continued`):
 * the learner just read it, so it shows its start, with a button to read it all again. A wide
 * screen has room for the whole text next to nothing else, so it never folds there. A recording
 * plays in its own player, with the exam's play limit kept across the set's questions and the
 * questions to read first (`questions`), and shows its transcript once they're answered
 * (`transcript`, from the last answer's feedback, or the view after a reload).
 */
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
