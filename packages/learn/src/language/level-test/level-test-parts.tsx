"use client";

import {
  type LanguageLevelTestView,
  type LevelTestRanges,
} from "@zoonk/core/language/level-test/contract";
import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { MediaPending } from "@zoonk/ui/components/media-pending";
import { useAudioKey } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { HeadphonesIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { SURFACE_CLASS } from "../../_components/surface";
import {
  SpeechFailedNote,
  SpeechStatusIcon,
  useSpeechActionLabel,
  withoutFailure,
} from "../../speech/speech-parts";
import { type useSpokenAudio } from "../../speech/use-spoken-audio";
import { useSkillName } from "../_utils/use-skill-name";
import { LevelBar } from "../level-bar";

/** Slower than normal, so a level test isn't a test of catching fast speech. */
const LISTENING_RATE = 0.9;

const MESSAGE_CLASS = cn(SURFACE_CLASS, "min-h-20");

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;
type LevelView = ReadyTest["levels"][number];
type TestQuestion = Extract<ReadyTest["next"], { kind: "question" }>["question"];

export function ListeningMessage({
  language,
  pending,
  question,
  speech,
}: {
  language: string;
  pending: boolean;
  question: TestQuestion;
  speech: ReturnType<typeof useSpokenAudio>;
}) {
  const t = useExtracted();
  const [played, setPlayed] = useState(false);
  const buttonState = withoutFailure(speech.state);
  const { status } = buttonState;

  const label = useSpeechActionLabel(
    buttonState,
    played ? t("Play the message again") : t("Play the message"),
  );

  const play = () => {
    setPlayed(true);

    speech.speak({
      rate: LISTENING_RATE,
      segments: [{ audioUrl: question.audio?.url ?? null, text: question.passage }],
    });
  };

  const toggle = status === "loading" || status === "playing" ? speech.cancel : play;

  const audioKey = useAudioKey(() => (speech.isAvailable && !pending ? toggle() : false));

  if (!speech.isAvailable) {
    return <p lang={language}>{question.passage}</p>;
  }

  if (pending) {
    return (
      <MediaPending
        className={cn(MESSAGE_CLASS, "text-muted-foreground")}
        icon={<HeadphonesIcon aria-hidden="true" className="size-5" />}
      >
        <p role="status">{t("The voice message is on its way…")}</p>
      </MediaPending>
    );
  }

  return (
    <div className={cn(MESSAGE_CLASS, "flex flex-col justify-center gap-3 p-4")}>
      <div className="flex items-center gap-3">
        <Button
          aria-busy={status === "loading"}
          onClick={toggle}
          size="icon-lg"
          type="button"
          {...audioKey}
        >
          <SpeechStatusIcon idle={<PlayIcon aria-hidden="true" />} state={buttonState} />
          <span className="sr-only">{label}</span>
        </Button>
        <p aria-live="polite" className="text-muted-foreground flex items-start gap-2 text-sm">
          <LineMarker aria-hidden="true">
            <HeadphonesIcon className="size-4" />
          </LineMarker>
          {status === "loading"
            ? t("Getting the message ready. The first time can take a few seconds.")
            : t("You got a voice message. Listen and answer.")}
        </p>
      </div>

      {speech.state.status === "failed" && (
        <SpeechFailedNote language={language} limit={speech.state.limit} onRetry={play} />
      )}
    </div>
  );
}

function LevelRows({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4">{children}</ul>;
}

function LevelRow({
  bar,
  label,
  skill,
}: {
  bar: React.ReactNode;
  label: string;
  skill: LevelView["skill"];
}) {
  const skillName = useSkillName();

  return (
    <li className="border-border col-span-3 grid min-h-11 grid-cols-subgrid items-center border-t py-2.5 first:border-t-0">
      <span className="text-sm font-medium">{skillName(skill)}</span>
      {bar}
      <span className="text-end font-mono text-xs font-medium tabular-nums">{label}</span>
    </li>
  );
}

/** "B1–B2": the levels a skill's answers place it between, never one level it can't promise. */
function formatLevelRange(range: { high: string; low: string }): string {
  return range.low === range.high ? range.low : `${range.low}–${range.high}`;
}

export function useLevelRangeFacts() {
  const t = useExtracted();

  return (ranges: LevelTestRanges): string[] => {
    const { listening: listeningRange, reading: readingRange } = ranges;
    const reading = readingRange && formatLevelRange(readingRange);
    const listening = listeningRange && formatLevelRange(listeningRange);

    return [
      reading &&
        t({
          description: "A CEFR level range the test found for reading, such as “B1–B2”.",
          message: "Reading {range}",
          values: { range: reading },
        }),
      listening &&
        t({
          description: "A CEFR level range the test found for listening, such as “B1–B2”.",
          message: "Listening {range}",
          values: { range: listening },
        }),
    ].filter((fact) => typeof fact === "string");
  };
}

const RANGE_SKILLS = ["reading", "listening"] as const;

export function LevelRanges({ ranges }: { ranges: LevelTestRanges }) {
  return (
    <LevelRows>
      {RANGE_SKILLS.map((skill) => {
        const range = ranges[skill];

        return (
          range && (
            <LevelRow
              bar={
                <LevelBar
                  range={{
                    high: CEFR_LEVELS.indexOf(range.high),
                    low: CEFR_LEVELS.indexOf(range.low),
                  }}
                />
              }
              key={skill}
              label={formatLevelRange(range)}
              skill={skill}
            />
          )
        );
      })}
    </LevelRows>
  );
}
