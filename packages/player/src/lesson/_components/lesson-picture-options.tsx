"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ImageIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { useOptionPicture } from "./lesson-pictures";
import { LessonStepImage } from "./lesson-step-image";

type PictureOption = {
  id: string;
  isCorrect: boolean;
  picture?: { alt: string; prompt: string };
  text: string;
};

function PictureOptionContent({
  isChecked,
  option,
  step,
}: {
  isChecked: boolean;
  option: PictureOption;
  step: PlayableLibraryStep;
}) {
  const t = useExtracted();
  const { image, pending } = useOptionPicture(step, option.id);
  const alt = option.picture?.alt ?? option.text;

  function picture() {
    if (image) {
      return <LessonStepImage className="w-full" frame="question" image={image} />;
    }

    if (pending) {
      return (
        <Skeleton className="bg-muted/60 text-muted-foreground flex aspect-4/5 w-full items-center justify-center rounded-lg">
          <ImageIcon aria-hidden="true" className="size-5" />
          <span className="sr-only" role="status">
            {t("Drawing the picture…")}
          </span>
          <p className="px-3 text-sm leading-snug">{alt}</p>
        </Skeleton>
      );
    }

    return (
      <p className="bg-muted/50 text-muted-foreground flex aspect-4/5 w-full items-center rounded-lg p-3 text-sm leading-snug">
        {alt}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {picture()}

      {isChecked && (
        <PlayerChoiceSceneOptionText>
          <span className="block px-1 pb-1 text-center font-medium">{option.text}</span>
        </PlayerChoiceSceneOptionText>
      )}
    </div>
  );
}

export function LessonPictureOptions({
  isChecked,
  isLocked,
  onSelect,
  options,
  selectedId,
  step,
}: {
  isChecked: boolean;
  isLocked: boolean;
  onSelect: (optionId: string | null) => void;
  options: readonly PictureOption[];
  selectedId: string | null;
  step: PlayableLibraryStep;
}) {
  return (
    <PlayerChoiceSceneOptions
      isChecked={isChecked}
      isLocked={isLocked}
      layout="grid"
      onSelect={(id) => onSelect(id === selectedId ? null : id)}
      options={options.map((option) => ({
        content: <PictureOptionContent isChecked={isChecked} option={option} step={step} />,
        isCorrect: option.isCorrect,
        key: option.id,
      }))}
      selectedKey={selectedId}
    />
  );
}
