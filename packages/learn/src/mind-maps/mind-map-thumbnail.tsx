"use client";

import { type MindMapImage, type MindMapOutline as Outline } from "@zoonk/core/mind-maps/contract";
import { toMindMapSrc } from "./_utils/mind-map-urls";
import { useMindMapAlt } from "./mind-map-description";

const THUMBNAIL_WIDTH = 640;

/** A map's picture where it's read small: the stored thumbnail until the place is wider than it. */
export function MindMapThumbnail({
  className,
  image,
  outline,
  sizes,
  title,
}: {
  className?: string;
  image: MindMapImage;
  outline: Outline;
  sizes: string;
  title: string;
}) {
  const alt = useMindMapAlt({ outline, title });

  return (
    // oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; maps are stored, optimized webp files.
    <img
      alt={alt}
      className={className}
      decoding="async"
      height={image.height}
      sizes={sizes}
      src={toMindMapSrc(image.url)}
      srcSet={`${toMindMapSrc(image.thumbnailUrl)} ${THUMBNAIL_WIDTH}w, ${toMindMapSrc(image.url)} ${image.width}w`}
      width={image.width}
    />
  );
}
