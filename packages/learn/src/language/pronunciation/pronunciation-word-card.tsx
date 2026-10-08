"use client";

import { type PronunciationReviewsView } from "@zoonk/core/language/pronunciation/contract";
import { Button } from "@zoonk/ui/components/button";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { cn } from "@zoonk/ui/lib/utils";
import { MicIcon, SnailIcon, SquareIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";
import { ItemLine } from "../../questions/item-text";
import { SpeechFailedNote, SpeechStatusIcon, withoutFailure } from "../../speech/speech-parts";
import { useSpokenAudio } from "../../speech/use-spoken-audio";

const MS_PER_SECOND = 1000;

type ReviewWord = PronunciationReviewsView["words"][number];

type Pace = "normal" | "slow";

/** Slow enough to hear each sound, close enough to real speech to still sound like the word. */
const SLOW_RATE = 0.7;

/**
 * Listen and Listen slowly: the native recording when the word has one, otherwise the word read
 * aloud in its language. The button that started the sound shows it loading, playing or failed.
 */
function WordListenButtons({ language, word }: { language: string; word: ReviewWord }) {
  const t = useExtracted();
  const speech = useSpokenAudio(language);
  const [pace, setPace] = useState<Pace>("normal");
  const buttonState = withoutFailure(speech.state);
  const { status } = buttonState;
  const isBusy = status === "loading" || status === "playing";

  const play = (next: Pace) => {
    setPace(next);

    speech.speak({
      rate: next === "slow" ? SLOW_RATE : 1,
      segments: [{ audioUrl: word.audioUrl, text: word.word }],
    });
  };

  const iconFor = (button: Pace, idle: ReactNode) =>
    button === pace ? <SpeechStatusIcon idle={idle} state={buttonState} /> : idle;

  if (!speech.isAvailable) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          aria-busy={pace === "normal" && status === "loading"}
          onClick={() => (isBusy && pace === "normal" ? speech.cancel() : play("normal"))}
          size="sm"
          type="button"
          variant="secondary"
        >
          {iconFor("normal", <Volume2Icon aria-hidden="true" />)}
          {t("Listen")}
        </Button>
        <Button
          aria-busy={pace === "slow" && status === "loading"}
          onClick={() => (isBusy && pace === "slow" ? speech.cancel() : play("slow"))}
          size="sm"
          type="button"
          variant="secondary"
        >
          {iconFor("slow", <SnailIcon aria-hidden="true" />)}
          {t("Listen slowly")}
        </Button>
      </div>

      {speech.state.status === "failed" && (
        <SpeechFailedNote
          className="items-center text-center"
          language={language}
          limit={speech.state.limit}
          onRetry={() => play(pace)}
        />
      )}
    </div>
  );
}

/** The word as a native speaker says it, then slowly, with how to spell and fix the sound. */
export function PronunciationWordCard({ language, word }: { language: string; word: ReviewWord }) {
  const t = useExtracted();

  return (
    <section
      aria-label={t("The word to say")}
      className="bg-muted/50 flex flex-col items-center gap-3 rounded-3xl p-6 text-center"
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

      <WordListenButtons language={language} word={word} />

      {word.tip && (
        <p className="text-muted-foreground max-w-sm text-sm text-balance">
          <ItemLine text={word.tip} />
        </p>
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
