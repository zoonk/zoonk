"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import Image from "next/image";
import { STEP_IMAGE_SIZES } from "../image-config";

/**
 * Teaching illustrations use descriptive alternatives, never production prompts.
 * The owning scene removes unavailable artwork so its complete text can use the space.
 */
export function StepImageView({
  alt,
  image,
  onError,
}: {
  alt: string;
  image: StepImage;
  onError: () => void;
}) {
  if (!image.url) {
    return null;
  }

  return (
    <div className="relative h-full w-full" data-slot="step-image-view">
      <Image
        alt={image.alt?.trim() || alt}
        className="object-contain"
        fill
        loading="eager"
        onError={onError}
        sizes={STEP_IMAGE_SIZES}
        src={image.url}
      />
    </div>
  );
}
