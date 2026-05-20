import { MediaCardImage } from "@zoonk/ui/components/media-card";
import Image, { type ImageProps } from "next/image";

/**
 * Course and chapter headers share the same media-card image treatment, so this
 * component keeps the sizing, eager loading, and crop styling in one place.
 */
export function CatalogHeaderImage({ alt, src }: { alt: string; src: ImageProps["src"] }) {
  return (
    <MediaCardImage>
      <Image
        alt={alt}
        className="size-full rounded-xl object-cover outline -outline-offset-1 outline-black/10 dark:outline-white/10"
        fill
        loading="eager"
        sizes="(max-width: 640px) 120px, 160px"
        src={src}
      />
    </MediaCardImage>
  );
}
