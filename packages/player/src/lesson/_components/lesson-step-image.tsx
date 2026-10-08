"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { OWN_FILES_WEB_PATH, getPrivateBlobPathname, toOwnFileUrl } from "@zoonk/utils/user-blobs";
import Image from "next/image";
import { useState } from "react";
import { type PlayableStepImage } from "../lesson-player-types";

/**
 * Pictures are at most a phone's width, or about 560px tall frames on larger screens. Every frame
 * shares this, so a picture preloaded for the next screen is the same file the screen shows.
 */
const LESSON_IMAGE_SIZES = "(max-width: 640px) 100vw, 560px";

/** Step pictures are drawn at 1024 by 1280; this ratio holds their space when a size isn't stored. */
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1280;

/**
 * How tall a picture may grow on each kind of screen: a reading screen's picture leads the screen
 * like a story; a question keeps room for its options; one inside a worked example sits between
 * its lines.
 */
export type LessonPictureFrame = "hero" | "inline" | "question";

export const PICTURE_FRAME_CLASS: Record<LessonPictureFrame, string> = {
  hero: "max-h-[55dvh]",
  inline: "max-h-[45dvh]",
  question: "max-h-[40dvh]",
};

/**
 * A step's picture, sized from the stored file so the text below never jumps as it loads, and
 * capped in height by its frame. A file that fails to load disappears instead of leaving a broken
 * frame; the text still teaches.
 */
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
  /** `eager` fetches a picture that isn't on screen yet, such as the next screen's. */
  loading?: "eager";
  priority?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (failedUrl === image.url) {
    return null;
  }

  /**
   * A private course's picture opens only with the learner's session, from main's file route; it
   * skips the image optimizer, whose shared cache would keep it for anyone with the address.
   */
  const isPrivate = getPrivateBlobPathname(image.url) !== null;

  return (
    <Image
      alt={image.alt}
      className={cn(
        "bg-muted/40 mx-auto block h-auto w-auto max-w-full rounded-2xl object-contain",
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
