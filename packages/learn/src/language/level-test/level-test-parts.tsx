"use client";

import { type LanguageLevelTestView } from "@zoonk/core/language/level-test/contract";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useCanRecord, useVoiceRecorder } from "@zoonk/ui/hooks/voice-recorder";
import { cn } from "@zoonk/ui/lib/utils";
import { HeadphonesIcon, MicIcon, PlayIcon, SquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { Meter, MeterFill } from "../../_components/meter";
import {
  SpeechFailedNote,
  SpeechStatusIcon,
  useSpeechActionLabel,
  withoutFailure,
} from "../../speech/speech-parts";
import { useSpokenAudio } from "../../speech/use-spoken-audio";
import { getLevelShare } from "../_utils/level-scale";
import { useSkillName } from "../_utils/use-skill-name";

const MS_PER_SECOND = 1000;
/** Slower than normal, so a level test isn't a test of catching fast speech. */
const LISTENING_RATE = 0.9;

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;
type LevelView = ReadyTest["levels"][number];

/** The voice message of a listening question, read aloud in the language it tests. */
export function ListeningMessage({ language, text }: { language: string; text: string }) {
  const t = useExtracted();
  const speech = useSpokenAudio(language);
  const [played, setPlayed] = useState(false);
  const buttonState = withoutFailure(speech.state);
  const { status } = buttonState;

  const label = useSpeechActionLabel(
    buttonState,
    played ? t("Play the message again") : t("Play the message"),
  );

  if (!speech.isAvailable) {
    return <p lang={language}>{text}</p>;
  }

  const play = () => {
    setPlayed(true);
    speech.speak({ rate: LISTENING_RATE, segments: [text] });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-center gap-3">
        <Button
          aria-busy={status === "loading"}
          onClick={status === "loading" || status === "playing" ? speech.cancel : play}
          size="icon-lg"
          type="button"
        >
          <SpeechStatusIcon idle={<PlayIcon aria-hidden="true" />} state={buttonState} />
          <span className="sr-only">{label}</span>
        </Button>
        <p
          aria-live="polite"
          className="text-muted-foreground flex items-start gap-2 text-sm text-pretty"
        >
          <LineMarker aria-hidden="true">
            <HeadphonesIcon className="size-4" />
          </LineMarker>
          {status === "loading"
            ? t("Getting the message ready. The first time can take a few seconds.")
            : t("You got a voice message. Listen and answer.")}
        </p>
      </div>

      {speech.state.status === "failed" && (
        <SpeechFailedNote
          language={language}
          limit={speech.state.limit}
          onRetry={play}
          text={text}
        />
      )}
    </div>
  );
}

/** The one sentence out loud: record, stop, and it's checked word by word. */
export function SpeakingPrompt({
  error,
  onRecorded,
  pending,
  sentence,
}: {
  error: string | null;
  onRecorded: (audio: Blob) => void;
  pending: boolean;
  sentence: ReadyTest["next"] & { kind: "speaking" };
}) {
  const t = useExtracted();
  const canRecord = useCanRecord();
  const handle = useCallback(({ audio }: { audio: Blob }) => onRecorded(audio), [onRecorded]);
  const recorder = useVoiceRecorder({ onRecorded: handle });
  const isRecording = recorder.status === "recording";

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="bg-muted/50 flex w-full flex-col gap-1 rounded-2xl p-4">
        <p className="text-2xl font-semibold tracking-tight">{sentence.speaking.sentence}</p>
        <p className="text-muted-foreground">{sentence.speaking.translation}</p>
      </div>

      {canRecord && recorder.status !== "denied" ? (
        <Button
          aria-pressed={isRecording}
          className={cn("size-20 rounded-full", isRecording && "motion-safe:animate-pulse")}
          disabled={pending}
          onClick={isRecording ? recorder.stop : () => void recorder.start()}
          size="icon-lg"
          variant={isRecording ? "destructive" : "default"}
        >
          {isRecording ? (
            <SquareIcon aria-hidden="true" className="size-7" />
          ) : (
            <MicIcon aria-hidden="true" className="size-8" />
          )}
          <span className="sr-only">{isRecording ? t("Stop") : t("Start speaking")}</span>
        </Button>
      ) : (
        <p>{t("The microphone isn't available here. You can skip this part.")}</p>
      )}

      <p aria-live="polite" className="text-muted-foreground text-sm">
        {pending && t("Listening to what you said…")}
        {!pending &&
          isRecording &&
          t("Recording… {seconds}s. Tap to stop.", {
            seconds: String(Math.floor(recorder.elapsedMs / MS_PER_SECOND)),
          })}
        {!pending && !isRecording && (error ?? t("Tap and say it out loud"))}
      </p>
    </div>
  );
}

/** The level of each skill as a bar on the A1 to C2 scale, with its label. */
export function LevelBars({ levels }: { levels: LevelView[] }) {
  const skillName = useSkillName();

  return (
    <ul className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3">
      {levels.map((level) => (
        <li className="col-span-3 grid grid-cols-subgrid items-center" key={level.skill}>
          <span className="text-sm">{skillName(level.skill)}</span>
          <Meter className="h-2">
            <MeterFill share={getLevelShare(level.score)} />
          </Meter>
          <span className="text-end text-sm font-semibold tabular-nums">{level.label}</span>
        </li>
      ))}
    </ul>
  );
}
