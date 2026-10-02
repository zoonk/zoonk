"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { OWN_FILES_WEB_PATH, getPrivateBlobPathname, toOwnFileUrl } from "@zoonk/utils/user-blobs";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { type PlayableStepImage } from "../lesson-player-types";

/** The reading column is at most 672px wide, so larger candidates only waste bytes. */
const LESSON_IMAGE_SIZES = "(max-width: 704px) 100vw, 672px";

/** Step images are 1536 by 1024; this ratio holds their space when a size isn't stored. */
const DEFAULT_WIDTH = 1536;
const DEFAULT_HEIGHT = 1024;

/**
 * A step's picture, sized from the stored file so the text below never jumps as it loads. A file
 * that fails to load disappears instead of leaving a broken frame; the text still teaches.
 */
export function LessonStepImage({
  className,
  image,
  priority = false,
}: {
  className?: string;
  image: PlayableStepImage;
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
      className={cn("bg-muted/40 h-auto w-full rounded-2xl object-contain", className)}
      height={image.height ?? DEFAULT_HEIGHT}
      onError={() => setFailedUrl(image.url)}
      preload={priority}
      sizes={LESSON_IMAGE_SIZES}
      src={toOwnFileUrl({ baseUrl: OWN_FILES_WEB_PATH, url: image.url })}
      unoptimized={isPrivate}
      width={image.width ?? DEFAULT_WIDTH}
    />
  );
}

/**
 * A question's picture. Pictures are drawn after the lesson is written and a failed one is left
 * out, so until it's there the question shows its description instead: a question never depends
 * on a picture the learner can't see.
 */
export function LessonQuestionPicture({
  image,
  priority = false,
  request,
}: {
  image: PlayableStepImage | null;
  priority?: boolean;
  /** The picture the writer asked for, whose alt text describes it. */
  request?: { alt: string } | null;
}) {
  if (image) {
    return <LessonStepImage image={image} priority={priority} />;
  }

  if (!request) {
    return null;
  }

  return (
    <figure className="bg-muted/50 text-muted-foreground flex items-start gap-3 rounded-2xl px-4 py-3 text-sm leading-relaxed">
      <ImageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <figcaption>{request.alt}</figcaption>
    </figure>
  );
}
