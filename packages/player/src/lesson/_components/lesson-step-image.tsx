"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { OWN_FILES_WEB_PATH, getPrivateBlobPathname, toOwnFileUrl } from "@zoonk/utils/user-blobs";
import Image from "next/image";
import { useState } from "react";
import { type PlayableStepImage } from "../lesson-player-types";

const LESSON_IMAGE_SIZES = "(max-width: 640px) 100vw, 560px";

/** The size new pictures are drawn at, for a picture whose payload lacks its own (stored ones carry it). */
const DRAWN_SIZE = {
  option: { height: 1024, width: 1024 },
  scene: { height: 1024, width: 1536 },
} as const;

export type LessonPictureKind = keyof typeof DRAWN_SIZE;

export type LessonPictureFrame = "hero" | "inline" | "question";

/**
 * On a phone a picture gives up height first, down to 140px, so the screen's words, a question's
 * options and its feedback stay in view on a 375 × 667 screen.
 */
export const PICTURE_FRAME_CLASS: Record<LessonPictureFrame, string> = {
  hero: "max-h-[55dvh] max-sm:max-h-[clamp(8.75rem,calc(100dvh_-_21rem),55dvh)]",
  inline: "max-h-[45dvh] max-sm:max-h-[clamp(8.75rem,calc(100dvh_-_30rem),45dvh)]",
  question: "max-h-[40dvh] max-sm:max-h-[clamp(8.75rem,calc(100dvh_-_36rem),40dvh)]",
};

export function LessonStepImage({
  className,
  frame = "inline",
  image,
  kind = "scene",
  loading,
  priority = false,
}: {
  className?: string;
  frame?: LessonPictureFrame;
  image: PlayableStepImage;
  kind?: LessonPictureKind;
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
      height={image.height ?? DRAWN_SIZE[kind].height}
      loading={loading}
      onError={() => setFailedUrl(image.url)}
      preload={priority}
      sizes={LESSON_IMAGE_SIZES}
      src={toOwnFileUrl({ baseUrl: OWN_FILES_WEB_PATH, url: image.url })}
      unoptimized={isPrivate}
      width={image.width ?? DRAWN_SIZE[kind].width}
    />
  );
}
