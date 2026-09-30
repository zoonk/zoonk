"use client";

import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySoundNote } from "../_components/activity-sound-button";
import { ChordDiagram } from "../_components/chord-diagram";
import { expectedInteraction } from "../_utils/activity-expected";
import { chordSymbol } from "../_utils/music-notes";
import { useInstrument } from "../_utils/use-instrument";
import { useChordName, useChordQualityName, useIntervalName } from "../_utils/use-music-labels";
import { type ActivityRendererProps } from "../activity-renderer";
import { EarTrainerAnswer } from "./ear-trainer-answer";
import { EarTrainerPlayer } from "./ear-trainer-player";
import {
  type EarOption,
  chordVoicing,
  earOptions,
  earTrainerSound,
  optionSound,
  progressionStarts,
} from "./ear-trainer-sounds";

type EarTrainerProps = ActivityRendererProps<"earTrainer">;

const MS = 1000;

function OptionLabel({ option }: { option: EarOption }) {
  const intervalName = useIntervalName();
  const qualityName = useChordQualityName();
  const chordName = useChordName();

  if (option.kind === "interval") {
    return (
      <PlayerChoiceSceneOptionText>{intervalName(option.interval)}</PlayerChoiceSceneOptionText>
    );
  }

  if (option.kind === "quality") {
    return <PlayerChoiceSceneOptionText>{qualityName(option.quality)}</PlayerChoiceSceneOptionText>;
  }

  const voicing = chordVoicing(option.chord);

  return (
    <span className="flex w-full items-center gap-3">
      <span className="flex flex-col">
        <span className="in-data-[mode=fun]:font-fun-display text-xl leading-tight font-bold">
          {chordSymbol(option.chord.root, option.chord.quality)}
        </span>
        <span className="text-sm opacity-80">
          {chordName(option.chord.root, option.chord.quality)}
        </span>
      </span>
      {voicing && <ChordDiagram className="ml-auto" voicing={voicing} />}
    </span>
  );
}

/** Follows a progression on screen: which chord is sounding, cleared when it ends. */
function useProgressionFollow() {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clear() {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  }

  useEffect(() => {
    const pending = timers;
    return () => pending.current.forEach((timer) => clearTimeout(timer));
  }, []);

  function follow(starts: readonly number[], total: number) {
    clear();

    timers.current = [
      ...starts.map((start, index) => setTimeout(() => setPlayingIndex(index), start * MS)),
      setTimeout(() => setPlayingIndex(null), total * MS),
    ];
  }

  return { follow, playingIndex };
}

/**
 * Hear an interval, a chord or a chord change and name it. Code plays it from the fields; the
 * choice is the answer. After the check the keys show what played, with the song that helps
 * remember it and a way to hear a wrong pick next to it.
 */
export function EarTrainerActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: EarTrainerProps) {
  const t = useExtracted();
  const { fields } = content;
  const instrument = useInstrument(fields.mode === "progression" ? "guitar" : "piano");
  const { follow, playingIndex } = useProgressionFollow();
  const [hasPlayed, setHasPlayed] = useState(false);
  const isChecked = phase === "checked";
  const options = earOptions(fields);
  const selectedId = answer?.kind === "selection" ? (answer.ids[0] ?? null) : null;

  const expectedIds = expectedInteraction(expected, "selection")?.ids ?? [];

  function play() {
    const sound = earTrainerSound(fields);
    const end = Math.max(...sound.map((event) => event.at)) + 1;

    setHasPlayed(true);
    void instrument.play(sound);

    if (fields.mode === "progression") {
      follow(progressionStarts(fields.chords.length), end);
    }
  }

  function handleSelect(index: number) {
    const option = options[index];

    if (isChecked || !option) {
      return;
    }

    onAnswerChange(option.id === selectedId ? null : { ids: [option.id], kind: "selection" });
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <EarTrainerPlayer
        fields={fields}
        hasPlayed={hasPlayed}
        isChecked={isChecked}
        onPlay={play}
        playingIndex={playingIndex}
      />

      <PlayerChoiceSceneOptions
        ariaLabel={t("Answer options")}
        keyboardEnabled={!isChecked}
        onSelect={handleSelect}
        options={options.map((option) => ({
          content: <OptionLabel option={option} />,
          disabled: isChecked,
          isDimmed: !isChecked && selectedId !== null && selectedId !== option.id,
          isSelected: selectedId === option.id,
          key: option.id,
          resultState: isChecked ? resultOf({ expectedIds, option, selectedId }) : null,
        }))}
      />

      {isChecked && (
        <EarTrainerAnswer
          chosen={options.find((option) => option.id === selectedId) ?? null}
          correct={options.find((option) => expectedIds.includes(option.id)) ?? null}
          fields={fields}
          onCompare={(option) => void instrument.play(optionSound(fields, option))}
        />
      )}

      <ActivitySoundNote status={instrument.status} />

      <ActivityTextAlternative>
        {t("A sound to name by ear. Press play to hear it, then pick what you heard.")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

function resultOf({
  expectedIds,
  option,
  selectedId,
}: {
  expectedIds: readonly string[];
  option: EarOption;
  selectedId: string | null;
}): "correct" | "incorrect" | null {
  if (expectedIds.includes(option.id)) {
    return "correct";
  }

  return option.id === selectedId ? "incorrect" : null;
}
