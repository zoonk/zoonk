"use client";

import {
  type LanguageLevelTestView,
  type LevelTestRanges,
} from "@zoonk/core/language/level-test/contract";
import { Button } from "@zoonk/ui/components/button";
import { Meter, MeterFill } from "@zoonk/ui/components/meter";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useAudioKey } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { formatClock } from "../../_utils/clock";
import {
  SpeechFailedNote,
  SpeechStatusIcon,
  useSpeechActionLabel,
  withoutFailure,
} from "../../speech/speech-parts";
import { type PlaybackTime } from "../../speech/speech-player-provider";
import { type useSpokenAudio } from "../../speech/use-spoken-audio";
import { useSkillName } from "../_utils/use-skill-name";
import { LevelBar } from "../level-bar";

/** Slower than normal, so a level test isn't a test of catching fast speech. */
const LISTENING_RATE = 0.9;

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;
type LevelView = ReadyTest["levels"][number];
type TestQuestion = Extract<ReadyTest["next"], { kind: "question" }>["question"];

/** The clip's own length is stretched by the slower rate it plays at. */
function toPlayedMs(clipMs: number): number {
  return clipMs / LISTENING_RATE;
}

/**
 * A listening question's message: play, a line that fills as it plays, and its length, which
 * counts down while it plays. `onHeard` says the message played to its end.
 */
export function ListeningMessage({
  language,
  onHeard,
  pending,
  question,
  speech,
}: {
  language: string;
  onHeard: () => void;
  pending: boolean;
  question: TestQuestion;
  speech: ReturnType<typeof useSpokenAudio>;
}) {
  const t = useExtracted();
  const [played, setPlayed] = useState(false);
  const [time, setTime] = useState<PlaybackTime | null>(null);
  const buttonState = withoutFailure(speech.state);
  const { status } = buttonState;
  const playing = status === "playing";
  const totalMs = time?.totalMs ?? question.audio?.durationMs ?? null;
  const elapsedMs = playing ? (time?.elapsedMs ?? 0) : 0;

  const label = useSpeechActionLabel(
    buttonState,
    played ? t("Play the message again") : t("Play the message"),
  );

  const play = () => {
    setPlayed(true);

    speech.speak({
      onDone: onHeard,
      onTime: setTime,
      rate: LISTENING_RATE,
      segments: [{ audioUrl: question.audio?.url ?? null, text: question.passage }],
    });
  };

  const toggle = status === "loading" || playing ? speech.cancel : play;

  const audioKey = useAudioKey(() => (speech.isAvailable && !pending ? toggle() : false));

  if (!speech.isAvailable) {
    return <p lang={language}>{question.passage}</p>;
  }

  return (
    <div className="flex flex-col gap-3" data-slot="listening-message">
      <div className="flex min-h-11 items-center gap-3">
        <Button
          aria-busy={status === "loading" || pending}
          disabled={pending}
          focusableWhenDisabled
          onClick={toggle}
          size="icon-lg"
          type="button"
          {...audioKey}
        >
          {pending ? (
            <Spinner aria-hidden="true" />
          ) : (
            <SpeechStatusIcon idle={<PlayIcon aria-hidden="true" />} state={buttonState} />
          )}
          <span className="sr-only">{label}</span>
        </Button>

        {pending ? (
          <p className="text-muted-foreground min-w-0 flex-1 text-sm" role="status">
            {t("The voice message is on its way…")}
          </p>
        ) : (
          <>
            <Meter className="h-1 min-w-0 flex-1 rounded-xs">
              <MeterFill
                className="rounded-xs transition-[width] duration-200 ease-linear motion-reduce:transition-none"
                share={playing && totalMs ? elapsedMs / totalMs : 0}
              />
            </Meter>

            {/* The length's room is kept while it isn't known yet, so the line never jumps. */}
            <span className="text-muted-foreground min-w-[4ch] text-end font-mono text-xs tabular-nums">
              {totalMs !== null && formatClock(toPlayedMs(totalMs - elapsedMs))}
            </span>
          </>
        )}
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
  muted = false,
  skill,
}: {
  bar: React.ReactNode;
  label: string;
  muted?: boolean;
  skill: LevelView["skill"];
}) {
  const skillName = useSkillName();

  return (
    <li className="border-border col-span-3 grid min-h-11 grid-cols-subgrid items-center border-t py-2.5 first:border-t-0">
      <span className="text-sm font-medium">{skillName(skill)}</span>
      {bar}
      <span
        className={cn(
          "text-end text-xs whitespace-nowrap tabular-nums",
          muted ? "text-muted-foreground" : "font-medium",
        )}
      >
        {label}
      </span>
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

const NO_BANDS = { high: -1, low: -1 };

/** Both skills, always: one the test didn't finish says so instead of showing a level. */
export function LevelRanges({ ranges }: { ranges: LevelTestRanges }) {
  const t = useExtracted();

  return (
    <LevelRows>
      {RANGE_SKILLS.map((skill) => {
        const range = ranges[skill];

        return (
          <LevelRow
            bar={
              <LevelBar
                range={
                  range
                    ? { high: CEFR_LEVELS.indexOf(range.high), low: CEFR_LEVELS.indexOf(range.low) }
                    : NO_BANDS
                }
              />
            }
            key={skill}
            label={range ? formatLevelRange(range) : t("Not tested yet")}
            muted={!range}
            skill={skill}
          />
        );
      })}
    </LevelRows>
  );
}
