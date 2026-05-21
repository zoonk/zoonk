import Image, { type ImageProps } from "next/image";

const catalogGridImageConfig = {
  compact: { size: 96, sizes: "(max-width: 640px) 82px, 96px" },
  default: { size: 112, sizes: "(max-width: 640px) 96px, 110px" },
} as const;

type CatalogGridImageSize = keyof typeof catalogGridImageConfig;

/**
 * Catalog tiles render images inside responsive grid media slots, so this keeps
 * the intrinsic size and browser `sizes` hint aligned anywhere the tile pattern
 * is reused.
 */
export function CatalogGridImage({
  alt,
  size = "default",
  src,
}: {
  alt: string;
  size?: CatalogGridImageSize;
  src: ImageProps["src"];
}) {
  const config = catalogGridImageConfig[size];

  return (
    <Image alt={alt} height={config.size} sizes={config.sizes} src={src} width={config.size} />
  );
}
