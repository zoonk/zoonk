"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { OWN_FILES_WEB_PATH, getPrivateBlobPathname, toOwnFileUrl } from "@zoonk/utils/user-blobs";
import Image from "next/image";
import { useState } from "react";
import { type PlayableStepImage } from "../lesson-player-types";

const LESSON_IMAGE_SIZES = "(max-width: 640px) 100vw, 560px";

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1280;

export type LessonPictureFrame = "hero" | "inline" | "question";

export const PICTURE_FRAME_CLASS: Record<LessonPictureFrame, string> = {
  hero: "max-h-[55dvh]",
  inline: "max-h-[45dvh]",
  question: "max-h-[40dvh]",
};

export function LessonStepImage({
  className,
  frame = "inline",
  image,
  loading,
  priority = false,
}: {
  className?: string;
  frame?: LessonPictureFrame;
  image: PlayableStepImage;
  loading?: "eager";
  priority?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (failedUrl === image.url) {
    return null;
  }

  /** Private images bypass the optimizer's shared cache so they remain session-protected. */
  const isPrivate = getPrivateBlobPathname(image.url) !== null;

  return (
    <Image
      alt={image.alt}
      className={cn(
        "bg-muted/40 block h-auto w-auto max-w-full rounded-xl object-contain",
        PICTURE_FRAME_CLASS[frame],
        className,
      )}
      data-frame={frame}
      height={image.height ?? DEFAULT_HEIGHT}
      loading={loading}
      onError={() => setFailedUrl(image.url)}
      preload={priority}
      sizes={LESSON_IMAGE_SIZES}
      src={toOwnFileUrl({ baseUrl: OWN_FILES_WEB_PATH, url: image.url })}
      unoptimized={isPrivate}
      width={image.width ?? DEFAULT_WIDTH}
    />
  );
}
