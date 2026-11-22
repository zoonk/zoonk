"use client";

import { DRAWN_PICTURE_SIZE, PICTURE_BOX_CLASS, pictureBoxStyle } from "@zoonk/learn/picture-box";
import { LessonRichText } from "@zoonk/learn/rich-text/lesson";
import { cn } from "@zoonk/ui/lib/utils";
import { useState } from "react";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { LessonPicturePending, useOptionPicture } from "./lesson-pictures";
import { LessonStepImage, PICTURE_FRAME_CLASS } from "./lesson-step-image";

type PictureOption = {
  id: string;
  isCorrect: boolean;
  picture?: { alt: string; prompt: string };
  text: string;
};

/** A picture 8px inside a 12px option, in every state: drawn, being drawn and described. */
const OPTION_PICTURE_CLASS = "mx-auto rounded-sm";

const OPTION_DESCRIPTION_CLASS = cn(
  OPTION_PICTURE_CLASS,
  PICTURE_BOX_CLASS,
  PICTURE_FRAME_CLASS.question,
  "col-start-1 row-start-1 max-h-none min-h-[min(100cqw,var(--picture-max-h))]",
);

const OPTION_DESCRIPTION_STYLE = {
  ...pictureBoxStyle(DRAWN_PICTURE_SIZE.option),
  aspectRatio: "auto",
};

const PENDING_PICTURE_STYLE = pictureBoxStyle(DRAWN_PICTURE_SIZE.option);

function PictureOptionContent({
  isChecked,
  option,
  step,
}: {
  isChecked: boolean;
  option: PictureOption;
  step: PlayableLibraryStep;
}) {
  const { image, pending } = useOptionPicture(step, option.id);
  // oxlint-disable-next-line react/hook-use-state -- The initial drawing state sizes this option until the screen closes.
  const [startedPending] = useState(pending);
  const pictureText = option.picture?.alt ?? <LessonRichText text={option.text} />;

  return (
    <div className="@container flex w-full flex-col gap-2">
      <div className="grid grid-cols-1">
        {(startedPending || pending) && (
          <LessonPicturePending
            aria-hidden={!pending || undefined}
            className={cn(
              OPTION_PICTURE_CLASS,
              PICTURE_BOX_CLASS,
              PICTURE_FRAME_CLASS.question,
              "col-start-1 row-start-1 overflow-hidden",
              "[&>div:last-child]:gap-1 [&>div:last-child]:p-2 [&>div:last-child]:text-xs [&>div:last-child>svg]:size-4",
              !pending && "invisible",
            )}
            style={PENDING_PICTURE_STYLE}
          >
            <p className="leading-snug wrap-anywhere">{pictureText}</p>
          </LessonPicturePending>
        )}

        {!image && !pending && (
          <p
            className={cn(
              OPTION_DESCRIPTION_CLASS,
              "bg-muted/50 grid place-items-center p-2 text-center text-sm leading-snug wrap-anywhere",
            )}
            style={OPTION_DESCRIPTION_STYLE}
          >
            {pictureText}
          </p>
        )}

        {image && (
          <LessonStepImage
            className={cn(OPTION_PICTURE_CLASS, "col-start-1 row-start-1 self-start")}
            frame="question"
            image={image}
            kind="option"
          />
        )}
      </div>

      {isChecked && (
        <PlayerChoiceSceneOptionText>
          <span className="block px-1 pb-1 text-center font-medium">
            <LessonRichText text={option.text} />
          </span>
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
