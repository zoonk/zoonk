"use client";

import { type PronunciationReviewsView } from "@zoonk/core/language/pronunciation/contract";
import { Button } from "@zoonk/ui/components/button";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { SnailIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";
import { CreateAccountLink } from "../../_components/create-account-link";
import { ItemLine } from "../../questions/item-text";
import { SpeechFailedNote, SpeechStatusIcon, withoutFailure } from "../../speech/speech-parts";
import { useSpokenAudio } from "../../speech/use-spoken-audio";
import { type PronunciationNotice } from "./use-pronunciation-round";

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
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          aria-busy={pace === "normal" && status === "loading"}
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

/**
 * The word on the page, as large as a title, as a native speaker says it, then slowly, with how
 * to spell the sound (in the mono face, letter by letter) and how to fix it.
 */
export function PronunciationWord({ language, word }: { language: string; word: ReviewWord }) {
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

      <WordListenButtons language={language} word={word} />

      {word.tip && (
        <p className="text-muted-foreground text-[0.8125rem] leading-snug text-pretty">
          <ItemLine text={word.tip} />
        </p>
      )}
    </section>
  );
}

/** Why the last recording wasn't graded, or null to ask for the word. */
function useNoticeMessage(notice: PronunciationNotice | null): string | null {
  const t = useExtracted();

  if (notice === "noSpeech") {
    return t("We couldn't hear the word. Try again a little closer.");
  }

  if (notice === "signUpRequired") {
    return t("Create your free account to continue.");
  }

  return notice === "failed" ? t("That didn't go through. Try again.") : null;
}

/**
 * The microphone for the word: whether this browser can record at all (it's false once the
 * learner blocked it), and the recorder the action bar's Record button drives.
 */
export function useWordRecorder(
  onRecorded: (recording: { audio: Blob; durationMs: number }) => void,
) {
  const canRecord = useCanRecord();
  const recorder = useVoiceRecorder({ onRecorded });

  return { available: canRecord && recorder.status !== "denied", recorder };
}

/**
 * What the microphone is doing, in one line under the word: say it, recording, listening to how
 * it sounded, or why the last try wasn't graded. A guest whose free tries are used gets the way
 * to an account.
 */
export function RecorderStatus({
  available,
  notice,
  pending,
  recording,
}: {
  available: boolean;
  notice: PronunciationNotice | null;
  pending: boolean;
  recording: boolean;
}) {
  const t = useExtracted();
  const message = useNoticeMessage(notice);

  if (!available) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("The microphone isn't available here. You can skip this word.")}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {pending && t("Listening to how it sounded…")}
        {!pending && recording && t("Recording… Press Stop when you're done.")}
        {!pending && !recording && (message ?? t("Press Record and say the word out loud"))}
      </p>

      {notice === "signUpRequired" && <CreateAccountLink />}
    </div>
  );
}
