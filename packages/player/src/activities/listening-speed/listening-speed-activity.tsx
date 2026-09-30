"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Lock, Pause, Play, RotateCcw } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { keepArrowKeys } from "../_utils/keep-arrow-keys";
import { useSpeech } from "../_utils/use-speech";
import { type ActivityRendererProps } from "../activity-renderer";
import { splitSentences, waveformBars } from "./listening-script";
import { ListeningTranscript } from "./listening-transcript";
import { SpeedPicker } from "./speed-picker";

type ListeningProps = ActivityRendererProps<"listeningSpeed">;

const BAR_COUNT = 32;
const PERCENT = 100;
const NORMAL_SPEED = 1;

/**
 * A voice message to hear at the speed the learner picks, one sentence back at a time, then a
 * question about it. The words stay hidden until the answer is checked; a learner who can't
 * listen right now can open them.
 */
export function ListeningSpeedActivity({ content, labelId, phase }: ListeningProps) {
  const t = useExtracted();
  const { fields } = content;
  const speech = useSpeech(fields.language);
  const sentences = splitSentences(fields.script, fields.language);
  const bars = waveformBars(fields.script, BAR_COUNT);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(NORMAL_SPEED);
  const [isRevealed, setIsRevealed] = useState(false);
  const isChecked = phase === "checked";
  const canListen = speech.status === "ready";
  const shared = Math.min((index + (isPlaying ? 1 : 0)) / sentences.length, 1);

  function playFrom(from: number, rate = speed) {
    setIndex(from);
    setIsPlaying(true);

    speech.speak({
      from,
      onDone: () => {
        setIsPlaying(false);
        setIndex(0);
      },
      onSegment: setIndex,
      rate,
      segments: sentences,
    });
  }

  function togglePlay() {
    if (isPlaying) {
      speech.cancel();
      setIsPlaying(false);
      return;
    }

    playFrom(index);
  }

  function goBack() {
    const previous = Math.max(index - 1, 0);

    if (isPlaying) {
      playFrom(previous);
      return;
    }

    setIndex(previous);
  }

  function changeSpeed(next: number) {
    setSpeed(next);

    if (isPlaying) {
      playFrom(index, next);
    }
  }

  return (
    <ActivityCanvas className="gap-3" labelId={labelId}>
      <div className="flex items-center gap-3">
        <button
          aria-label={isPlaying ? t("Pause") : t("Play the message")}
          className="bg-primary text-primary-foreground focus-visible:ring-ring/50 flex size-12 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] disabled:opacity-50"
          disabled={!canListen}
          onClick={togglePlay}
          onKeyDown={keepArrowKeys}
          type="button"
        >
          {isPlaying ? (
            <Pause aria-hidden="true" className="size-5 fill-current" />
          ) : (
            <Play aria-hidden="true" className="size-5 translate-x-px fill-current" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div aria-hidden="true" className="flex h-8 items-center gap-[3px]">
            {bars.map((height, bar) => (
              <span
                className={cn(
                  "flex-1 rounded-full motion-safe:transition-colors",
                  bar / BAR_COUNT < shared ? "bg-foreground" : "bg-muted-foreground/30",
                )}
                key={`${String(bar)}-${String(height)}`}
                style={{ height: `${height * PERCENT}%` }}
              />
            ))}
          </div>

          <div className="text-muted-foreground flex justify-between gap-2 text-xs tabular-nums">
            <span className="truncate">{fields.voice}</span>
            <span aria-live="polite">
              {t("Sentence {current} of {total}", {
                current: String(index + 1),
                total: String(sentences.length),
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
        <button
          aria-label={t("One sentence back")}
          className="border-border bg-background focus-visible:ring-ring/50 flex size-11 items-center justify-center rounded-full border outline-none focus-visible:ring-[3px] disabled:opacity-50"
          disabled={!canListen || (index === 0 && !isPlaying)}
          onClick={goBack}
          onKeyDown={keepArrowKeys}
          title={t("One sentence back")}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
        </button>

        <SpeedPicker
          className="ml-auto"
          onChange={changeSpeed}
          speed={speed}
          speeds={fields.speeds}
        />
      </div>

      {!canListen && speech.status === "unavailable" && (
        <p className="text-muted-foreground text-sm" role="status">
          {t("This device has no voice for this language, so the message can't play here.")}
        </p>
      )}

      {isChecked || isRevealed ? (
        <ListeningTranscript current={isPlaying ? index : null} sentences={sentences} />
      ) : (
        <div className="border-border text-muted-foreground flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed px-4 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Lock aria-hidden="true" className="size-4" />
            {t("The words open after you answer")}
          </span>

          <button
            className="text-foreground ml-auto min-h-11 underline underline-offset-4"
            onClick={() => setIsRevealed(true)}
            onKeyDown={keepArrowKeys}
            type="button"
          >
            {t("Can't listen now? Show the words")}
          </button>
        </div>
      )}

      <ActivityTextAlternative>
        {t("A voice message you can play at different speeds. Its words show after you answer.")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
