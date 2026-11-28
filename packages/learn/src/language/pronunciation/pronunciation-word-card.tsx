"use client";

import { type PronunciationReviewsView } from "@zoonk/core/language/pronunciation/contract";
import { Button } from "@zoonk/ui/components/button";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { SnailIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { ItemLine } from "../../questions/item-text";
import { SpeechFailedNote, SpeechStatusIcon, withoutFailure } from "../../speech/speech-parts";
import { useSpokenAudio } from "../../speech/use-spoken-audio";

type ReviewWord = PronunciationReviewsView["words"][number];

type Pace = "normal" | "slow";

const SLOW_RATE = 0.7;

function WordListenButtons({
  disabled,
  language,
  word,
}: {
  disabled: boolean;
  language: string;
  word: ReviewWord;
}) {
  const t = useExtracted();
  const speech = useSpokenAudio(language);
  const [pace, setPace] = useState<Pace>("normal");
  const buttonState = withoutFailure(speech.state);
  const { status } = buttonState;
  const isBusy = status === "loading" || status === "playing";
  const { cancel } = speech;

  // A clip still loading when Record is pressed would otherwise play into the take.
  useEffect(() => {
    if (disabled) {
      cancel();
    }
  }, [cancel, disabled]);

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
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          aria-busy={pace === "normal" && status === "loading"}
          disabled={disabled}
          onClick={() => (isBusy && pace === "normal" ? speech.cancel() : play("normal"))}
          size="sm"
          type="button"
          variant="outline"
        >
          {iconFor("normal", <Volume2Icon aria-hidden="true" />)}
          {t("Listen")}
        </Button>
        <Button
          aria-busy={pace === "slow" && status === "loading"}
          disabled={disabled}
          onClick={() => (isBusy && pace === "slow" ? speech.cancel() : play("slow"))}
          size="sm"
          type="button"
          variant="outline"
        >
          {iconFor("slow", <SnailIcon aria-hidden="true" />)}
          {t("Listen slowly")}
        </Button>
      </div>

      {speech.state.status === "failed" && (
        <SpeechFailedNote
          language={language}
          limit={speech.state.limit}
          onRetry={() => play(pace)}
        />
      )}
    </div>
  );
}

export function PronunciationWord({
  cue,
  language,
  recording = false,
  word,
}: {
  cue?: ReactNode;
  language: string;
  recording?: boolean;
  word: ReviewWord;
}) {
  const t = useExtracted();

  return (
    <section aria-label={t("The word to say")} className="flex flex-col items-start gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-title" lang={language}>
          {word.word}
        </p>

        {word.romanization && <p className="text-muted-foreground">{word.romanization}</p>}

        {word.respelling && (
          <p className="text-muted-foreground text-sm">
            {t("Say it like")}{" "}
            <span className="text-foreground font-mono font-medium">{word.respelling}</span>
          </p>
        )}
      </div>

      <WordListenButtons disabled={recording} language={language} word={word} />

      {word.tip && (
        <p className="text-muted-foreground text-compact leading-snug">
          <ItemLine text={word.tip} />
        </p>
      )}

      {cue}
    </section>
  );
}

export function useWordRecorder(
  onRecorded: (recording: { audio: Blob; durationMs: number }) => void,
) {
  const canRecord = useCanRecord();
  const recorder = useVoiceRecorder({ onRecorded });

  return { available: canRecord && recorder.status !== "denied", recorder };
}
