"use client";

import { DRAWN_PICTURE_SIZE, PICTURE_BOX_CLASS, pictureBoxStyle } from "@zoonk/learn/picture-box";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
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
  // oxlint-disable-next-line react/hook-use-state -- The initial drawing state sizes this option until the screen closes.
  const [startedPending] = useState(pending);
  const pictureText = option.picture?.alt ?? <LessonRichText text={option.text} />;

  return (
    <div className="@container flex w-full flex-col gap-2">
      <div className="grid grid-cols-1">
        {/* Keep the description's room when its picture arrives, including on a narrow phone. */}
        {(!image || startedPending) && (
          <div
            className={cn(
              OPTION_PICTURE_BOX_CLASS,
              "bg-muted/50 relative col-start-1 row-start-1 grid max-h-none min-h-[min(100cqw,var(--picture-max-h))] place-items-center overflow-hidden p-2 text-center text-sm leading-snug wrap-anywhere",
              pending && "text-muted-foreground",
              image && "invisible",
            )}
            data-slot="picture-option-frame"
            style={{ ...OPTION_PICTURE_BOX_STYLE, aspectRatio: "auto" }}
          >
            {!image && pending && (
              <>
                <Skeleton
                  aria-hidden="true"
                  className="bg-muted/60 absolute inset-0 rounded-none"
                />
                <p className="sr-only" role="status">
                  {t("Drawing the picture…")}
                </p>
              </>
            )}

            <p className="relative">{pictureText}</p>
          </div>
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
