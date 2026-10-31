"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { HeadphonesIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Meter, MeterFill } from "../_components/meter";
import { SURFACE_CLASS } from "../_components/surface";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

type Status = "failed" | "idle" | "loading" | "playing";

function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / MS_PER_SECOND));
  const rest = seconds % SECONDS_PER_MINUTE;
  return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(rest).padStart(2, "0")}`;
}

function usePlaysNote({
  played,
  plays,
  restarted,
}: {
  played: number;
  plays: number | null;
  restarted: boolean;
}): string {
  const t = useExtracted();

  if (plays === null) {
    return t("Listen again as often as you like.");
  }

  if (restarted && played < plays) {
    return t("The recording stopped before the end, so you can play it once more from the start.");
  }

  if (played >= plays) {
    return t("You've used every play. Answer from what you heard.");
  }

  if (played > 0) {
    return t("You can listen one more time.");
  }

  return plays === 1
    ? t("You hear it once, like in the exam. Read the questions first.")
    : t("You hear it twice, like in the exam. Read the questions first.");
}

/**
 * `plays` null is review: play, pause and replay freely. A play counts once its sound starts, so a
 * recording that fails to load loses none.
 */
export function ListeningPlayer({
  durationMs,
  onEnded,
  onInterrupted,
  onPlayed,
  played,
  plays,
  restarted = false,
  title,
  url,
}: {
  durationMs: number | null;
  onEnded?: () => void;
  onInterrupted?: () => void;
  onPlayed: () => void;
  played: number;
  plays: number | null;
  restarted?: boolean;
  title: string | null;
  url: string;
}) {
  const t = useExtracted();
  const audioRef = useRef<HTMLAudioElement>(null);
  const countedRef = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [totalMs, setTotalMs] = useState(durationMs ?? 0);
  const note = usePlaysNote({ played, plays, restarted });
  const isReview = plays === null;
  const isUsedUp = !isReview && played >= plays;

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  const play = async () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!isReview || audio.ended) {
      audio.currentTime = 0;
    }

    countedRef.current = false;
    setStatus("loading");

    try {
      await audio.play();
    } catch {
      setStatus("failed");
    }
  };

  const handlePlaying = () => {
    setStatus("playing");

    if (!isReview && !countedRef.current) {
      countedRef.current = true;
      onPlayed();
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setStatus("idle");
  };

  // A counted play that stops short of its end was cut off: the learner has no pause outside review.
  const handlePause = (event: React.SyntheticEvent<HTMLAudioElement>) => {
    if (isReview || event.currentTarget.ended || !countedRef.current) {
      return;
    }

    countedRef.current = false;
    setStatus("idle");
    onInterrupted?.();
  };

  const handleError = () => {
    setStatus("failed");

    if (!isReview && countedRef.current) {
      onInterrupted?.();
    }
  };

  const nextPlayLabel = played > 0 ? t("Play it again") : t("Play the recording");
  const playLabel = status === "playing" ? t("Playing") : nextPlayLabel;

  return (
    <section aria-label={t("Recording")} className={cn(SURFACE_CLASS, "flex flex-col gap-3 p-4")}>
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- The transcript shows after answering; a caption would give the answers away. */}
      <audio
        onEnded={() => {
          setStatus("idle");
          onEnded?.();
        }}
        onError={handleError}
        onLoadedMetadata={(event) => setTotalMs(event.currentTarget.duration * MS_PER_SECOND)}
        onPause={handlePause}
        onPlaying={handlePlaying}
        onTimeUpdate={(event) => setElapsedMs(event.currentTarget.currentTime * MS_PER_SECOND)}
        preload="auto"
        ref={audioRef}
        src={url}
      />

      <div className="flex items-center gap-3">
        {status === "playing" && isReview ? (
          <Button onClick={pause} size="icon-lg" type="button" variant="outline">
            <PauseIcon aria-hidden="true" />
            <span className="sr-only">{t("Pause")}</span>
          </Button>
        ) : (
          <Button
            aria-busy={status === "loading"}
            disabled={isUsedUp || status === "playing" || status === "loading"}
            onClick={() => void play()}
            size="icon-lg"
            type="button"
          >
            {played > 0 && !isReview ? (
              <RotateCcwIcon aria-hidden="true" />
            ) : (
              <PlayIcon aria-hidden="true" />
            )}
            <span className="sr-only">{playLabel}</span>
          </Button>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <LineMarker aria-hidden="true">
              <HeadphonesIcon className="size-4" />
            </LineMarker>
            <span className="truncate">{title ?? t("Recording")}</span>
          </p>

          <Meter>
            <MeterFill share={totalMs > 0 ? elapsedMs / totalMs : 0} />
          </Meter>

          <p className="text-muted-foreground font-mono text-[0.6875rem] tabular-nums">
            {t("{elapsed} of {total}", {
              elapsed: formatClock(elapsedMs),
              total: formatClock(totalMs),
            })}
          </p>
        </div>
      </div>

      <p aria-live="polite" className="text-muted-foreground text-sm text-pretty">
        {status === "failed" &&
          t("The recording didn't load. Check your connection and try again.")}
        {status === "playing" && !isReview && t("Playing. It doesn't pause, like in the exam.")}
        {status !== "failed" && (status !== "playing" || isReview) && note}
      </p>
    </section>
  );
}
