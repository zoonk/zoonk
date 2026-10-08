import Image, { type ImageProps } from "next/image";

/** The catalog tile's media is 64px on phones (a list row) and 112px from `sm` (a card). */
const CATALOG_IMAGE_SIZE = 112;
const CATALOG_IMAGE_SIZES = "(max-width: 640px) 64px, 112px";

/**
 * A course picture filling its catalog tile. The first rows' pictures (`eager`) load at once, since
 * one of them is the page's largest paint; the rest wait until they're near the screen.
 */
export function CatalogGridImage({
  alt,
  eager = false,
  src,
}: {
  alt: string;
  eager?: boolean;
  src: ImageProps["src"];
}) {
  return (
    <Image
      alt={alt}
      height={CATALOG_IMAGE_SIZE}
      loading={eager ? "eager" : undefined}
      sizes={CATALOG_IMAGE_SIZES}
      src={src}
      width={CATALOG_IMAGE_SIZE}
    />
  );
}
