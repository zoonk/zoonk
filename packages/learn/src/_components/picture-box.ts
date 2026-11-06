import { type CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";

/** The size new pictures are drawn at, for a picture whose payload lacks its own (stored ones carry it). */
export const DRAWN_PICTURE_SIZE = {
  option: { height: 1024, width: 1024 },
  scene: { height: 1024, width: 1536 },
} as const;

/**
 * A picture's box before its file arrives, so the words under it never move: as wide as the column
 * allows under the height cap in `--picture-max-h`, and as tall as its shape makes that width.
 */
export const PICTURE_BOX_CLASS =
  "h-auto max-h-(--picture-max-h) w-[min(100%,calc(var(--picture-max-h)*var(--picture-ratio)))]";

export function pictureBoxStyle({
  height,
  width,
}: {
  height: number;
  width: number;
}): CSSPropertiesWithVariables {
  return { "--picture-ratio": width / height, aspectRatio: `${width} / ${height}` };
}
