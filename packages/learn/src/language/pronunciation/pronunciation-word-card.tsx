"use client";

import { type PronunciationReviewsView } from "@zoonk/core/language/pronunciation/contract";
import { Button } from "@zoonk/ui/components/button";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { cn } from "@zoonk/ui/lib/utils";
import { MicIcon, SnailIcon, SquareIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useWordAudio } from "./use-word-audio";

const MS_PER_SECOND = 1000;

type ReviewWord = PronunciationReviewsView["words"][number];

/** The word as a native speaker says it, then slowly, with how to spell and fix the sound. */
export function PronunciationWordCard({ language, word }: { language: string; word: ReviewWord }) {
  const t = useExtracted();
  const audio = useWordAudio({ audioUrl: word.audioUrl, language, word: word.word });

  return (
    <section
      aria-label={t("The word to say")}
      className="bg-muted/50 in-data-[mode=fun]:fun-glass flex flex-col items-center gap-3 rounded-3xl p-6 text-center"
    >
      <p className="text-4xl font-semibold tracking-tight" lang={language}>
        {word.word}
      </p>

      {word.romanization && <p className="text-muted-foreground">{word.romanization}</p>}

      {word.respelling && (
        <p className="text-sm">
          {t("Say it like")} <span className="font-semibold tracking-wide">{word.respelling}</span>
        </p>
      )}

      {audio.canPlay && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => audio.play(false)} size="sm" type="button" variant="secondary">
            <Volume2Icon aria-hidden="true" />
            {t("Listen")}
          </Button>
          <Button onClick={() => audio.play(true)} size="sm" type="button" variant="secondary">
            <SnailIcon aria-hidden="true" />
            {t("Listen slowly")}
          </Button>
        </div>
      )}

      {word.tip && (
        <p className="text-muted-foreground max-w-sm text-sm text-balance">{word.tip}</p>
      )}
    </section>
  );
}

/** Why the last recording wasn't graded, or null to ask for the word. */
function useNoticeMessage(notice: "failed" | "noSpeech" | null): string | null {
  const t = useExtracted();

  if (notice === "noSpeech") {
    return t("We couldn't hear the word. Try again a little closer.");
  }

  return notice === "failed" ? t("That didn't go through. Try again.") : null;
}

/** Record, stop, and the word is checked; a word already graded shows no microphone. */
export function PronunciationRecorder({
  notice,
  onRecorded,
  pending,
}: {
  notice: "failed" | "noSpeech" | null;
  onRecorded: (recording: { audio: Blob; durationMs: number }) => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const message = useNoticeMessage(notice);
  const canRecord = useCanRecord();
  const recorder = useVoiceRecorder({ onRecorded });
  const isRecording = recorder.status === "recording";

  if (!canRecord || recorder.status === "denied") {
    return (
      <p className="text-muted-foreground text-center text-sm" role="status">
        {t("The microphone isn't available here. You can skip this word.")}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        aria-pressed={isRecording}
        className={cn("size-20 rounded-full", isRecording && "motion-safe:animate-pulse")}
        disabled={pending}
        onClick={isRecording ? recorder.stop : () => void recorder.start()}
        size="icon-lg"
        type="button"
        variant={isRecording ? "destructive" : "default"}
      >
        {isRecording ? (
          <SquareIcon aria-hidden="true" className="size-7" />
        ) : (
          <MicIcon aria-hidden="true" className="size-8" />
        )}
        <span className="sr-only">{isRecording ? t("Stop") : t("Say the word")}</span>
      </Button>

      <p aria-live="polite" className="text-muted-foreground text-center text-sm">
        {pending && t("Listening to how it sounded…")}
        {!pending &&
          isRecording &&
          t("Recording… {seconds}s. Tap to stop.", {
            seconds: String(Math.floor(recorder.elapsedMs / MS_PER_SECOND)),
          })}
        {!pending && !isRecording && (message ?? t("Tap and say the word out loud"))}
      </p>
    </div>
  );
}
