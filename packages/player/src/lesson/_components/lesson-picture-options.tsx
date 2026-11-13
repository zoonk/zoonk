"use client";

import { DRAWN_PICTURE_SIZE, PICTURE_BOX_CLASS, pictureBoxStyle } from "@zoonk/learn/picture-box";
import { MediaPending } from "@zoonk/ui/components/media-pending";
import { cn } from "@zoonk/ui/lib/utils";
import { ImageIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  PlayerChoiceSceneOptionText,
  PlayerChoiceSceneOptions,
} from "../../components/player-choice-scene";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { useOptionPicture } from "./lesson-pictures";
import { LessonRichText } from "./lesson-rich-text";
import { LessonStepImage, PICTURE_FRAME_CLASS } from "./lesson-step-image";

type PictureOption = {
  id: string;
  isCorrect: boolean;
  picture?: { alt: string; prompt: string };
  text: string;
};

/** A picture 8px inside a 12px option, in every state: drawn, being drawn and described. */
const OPTION_PICTURE_CLASS = "mx-auto rounded-sm";

/** The room a drawn option takes, held by the two states that have no file. */
const OPTION_PICTURE_BOX_CLASS = cn(
  OPTION_PICTURE_CLASS,
  PICTURE_BOX_CLASS,
  PICTURE_FRAME_CLASS.question,
);

const OPTION_PICTURE_BOX_STYLE = pictureBoxStyle(DRAWN_PICTURE_SIZE.option);

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
  const pictureText = option.picture?.alt ?? <LessonRichText text={option.text} />;

  function picture() {
    if (image) {
      return (
        <LessonStepImage
          className={OPTION_PICTURE_CLASS}
          frame="question"
          image={image}
          kind="option"
        />
      );
    }

    if (pending) {
      return (
        <MediaPending
          className={OPTION_PICTURE_BOX_CLASS}
          icon={<ImageIcon aria-hidden="true" className="size-5 shrink-0" />}
          style={OPTION_PICTURE_BOX_STYLE}
        >
          <span className="sr-only" role="status">
            {t("Drawing the picture…")}
          </span>
          <p className="leading-snug">{pictureText}</p>
        </MediaPending>
      );
    }

    return (
      <p
        className={cn(
          "bg-muted/50 text-muted-foreground flex items-center p-3 text-sm leading-snug",
          OPTION_PICTURE_BOX_CLASS,
        )}
        style={OPTION_PICTURE_BOX_STYLE}
      >
        {pictureText}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {picture()}

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
