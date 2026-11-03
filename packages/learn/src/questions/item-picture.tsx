"use client";

import { OWN_FILES_WEB_PATH, toOwnFileUrl } from "@zoonk/utils/user-blobs";
import { useState } from "react";

/** The size new question pictures are drawn at, for a picture whose payload lacks its own (stored ones carry it). */
const DRAWN_SIZE = { height: 1024, width: 1536 } as const;

export type ItemPictureData = {
  alt: string;
  height: number | null;
  url: string;
  width: number | null;
};

export function ItemPicture({ image }: { image: ItemPictureData }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (failedUrl === image.url) {
    return null;
  }

  return (
    // oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; question pictures are stored, optimized webp files.
    <img
      alt={image.alt}
      className="bg-muted/40 mx-auto h-auto max-h-[55dvh] w-auto max-w-full rounded-xl object-contain"
      data-slot="item-picture"
      decoding="async"
      height={image.height ?? DRAWN_SIZE.height}
      onError={() => setFailedUrl(image.url)}
      src={toOwnFileUrl({ baseUrl: OWN_FILES_WEB_PATH, url: image.url })}
      width={image.width ?? DRAWN_SIZE.width}
    />
  );
}
