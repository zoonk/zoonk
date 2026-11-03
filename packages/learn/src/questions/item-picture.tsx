"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { OWN_FILES_WEB_PATH, toOwnFileUrl } from "@zoonk/utils/user-blobs";
import { useState } from "react";
import { PICTURE_BOX_CLASS, pictureBoxStyle } from "../_components/picture-box";

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

  const size = {
    height: image.height ?? DRAWN_SIZE.height,
    width: image.width ?? DRAWN_SIZE.width,
  };

  return (
    // oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; question pictures are stored, optimized webp files.
    <img
      alt={image.alt}
      className={cn(
        "bg-muted/40 mx-auto rounded-xl object-contain [--picture-max-h:55dvh]",
        PICTURE_BOX_CLASS,
      )}
      data-slot="item-picture"
      decoding="async"
      height={size.height}
      onError={() => setFailedUrl(image.url)}
      src={toOwnFileUrl({ baseUrl: OWN_FILES_WEB_PATH, url: image.url })}
      style={pictureBoxStyle(size)}
      width={size.width}
    />
  );
}
