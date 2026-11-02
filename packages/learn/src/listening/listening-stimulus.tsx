"use client";

import { type ListeningSetView } from "@zoonk/core/library/listening/view";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ItemLine } from "../questions/item-text";
import { ListeningPlayer } from "./listening-player";
import { useListeningPlays } from "./use-listening-plays";

export type ListeningQuestions = { current: number; prompts: string[] };

/** `record` resolves false when the mock had no play left (another page used the last one). */
export type ServedPlays = { played: number; record: () => Promise<boolean> };

function Fold({
  children,
  label,
  onToggle,
  open,
}: {
  children: React.ReactNode;
  label: string;
  onToggle: () => void;
  open: boolean;
}) {
  const contentId = useId();

  return (
    <div className="flex flex-col gap-3">
      <Button
        aria-controls={contentId}
        aria-expanded={open}
        className="self-start"
        onClick={onToggle}
        size="sm"
        type="button"
        variant="outline"
      >
        {label}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </Button>

      {open && <div id={contentId}>{children}</div>}
    </div>
  );
}

function ListeningTranscript({
  transcript,
}: {
  transcript: NonNullable<ListeningSetView["transcript"]>;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);

  return (
    <section aria-label={t("Transcript")}>
      <Fold label={t("Transcript")} onToggle={() => setOpen(!open)} open={open}>
        <ol className="flex flex-col gap-3 text-sm">
          {transcript.map((turn, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- Turns never move, and one speaker may say the same words twice.
            <li className="flex flex-col gap-0.5" key={index}>
              {transcript[index - 1]?.speaker !== turn.speaker && (
                <span className="font-medium">{turn.speaker}</span>
              )}
              <p className="text-pretty">{turn.text}</p>
            </li>
          ))}
        </ol>
      </Fold>
    </section>
  );
}

function ListeningQuestionList({
  onToggle,
  open,
  questions,
}: {
  onToggle: () => void;
  open: boolean;
  questions: ListeningQuestions;
}) {
  const t = useExtracted();

  return (
    <Fold
      label={t(
        "{count, plural, =0 {Questions on this recording (#)} one {Question on this recording (#)} other {Questions on this recording (#)}}",
        { count: questions.prompts.length },
      )}
      onToggle={onToggle}
      open={open}
    >
      <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm">
        {questions.prompts.map((prompt, index) => (
          <li
            aria-current={index === questions.current ? "step" : undefined}
            className={cn(
              "text-pretty",
              index === questions.current ? "font-medium" : "text-muted-foreground",
            )}
            // oxlint-disable-next-line react/no-array-index-key -- Questions keep their order, and two may ask the same words.
            key={index}
          >
            <ItemLine text={prompt} />
          </li>
        ))}
      </ol>
    </Fold>
  );
}

export function ListeningStimulus({
  playsKey,
  practice = false,
  questions = null,
  served = null,
  set,
}: {
  playsKey: string;
  practice?: boolean;
  questions?: ListeningQuestions | null;
  served?: ServedPlays | null;
  set: ListeningSetView;
}) {
  const local = useListeningPlays({ playsKey, restartOnce: practice });
  const { onEnded, onInterrupted, onPlayed, restarted } = local;
  const played = Math.max(local.played, served?.played ?? 0);

  const answered = set.transcript !== null;

  const [toggled, setToggled] = useState<boolean | null>(null);
  // A play the mock refused remounts the player, which stops its sound.
  const [refused, setRefused] = useState(0);
  const listOpen = toggled ?? played === 0;

  if (!set.audio) {
    return null;
  }

  const handlePlayed = () => {
    setToggled(null);
    onPlayed();

    void served?.record().then((allowed) => {
      if (!allowed) {
        setRefused((count) => count + 1);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {set.task && <p className="text-muted-foreground text-sm text-pretty">{set.task}</p>}

      <ListeningPlayer
        key={refused}
        durationMs={set.audio.durationMs}
        onEnded={onEnded}
        onInterrupted={onInterrupted}
        onPlayed={handlePlayed}
        played={played}
        plays={answered ? null : set.plays}
        restarted={restarted}
        title={set.title}
        url={set.audio.url}
      />

      {questions && questions.prompts.length > 1 && !answered && (
        <ListeningQuestionList
          onToggle={() => setToggled(!listOpen)}
          open={listOpen}
          questions={questions}
        />
      )}

      {set.transcript && <ListeningTranscript transcript={set.transcript} />}
    </div>
  );
}
