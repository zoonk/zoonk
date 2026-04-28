"use client";

import Image from "next/image";
import { SELECT_IMAGE_PROPS, STEP_IMAGE_PRELOAD_PROPS } from "../image-config";
import { type PreloadableImage } from "../player-selectors";

/**
 * Renders hidden Next.js `<Image>` components for upcoming steps so the browser
 * fetches the optimized `/_next/image` URLs before the user navigates to them.
 * When the real step mounts with the same props, the browser serves the image
 * from its HTTP cache — making it appear instantly.
 *
 * The wrapper keeps the preloaded images mounted but visually unavailable, so
 * `loading="eager"` can trigger the fetch without adding visible layout.
 */
export function StepImagePreloader({ images }: { images: PreloadableImage[] }) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute size-px overflow-hidden opacity-0"
    >
      {images.map((image) => {
        const props = image.kind === "step" ? STEP_IMAGE_PRELOAD_PROPS : SELECT_IMAGE_PROPS;
        return <Image alt="" key={image.url} loading="eager" src={image.url} {...props} />;
      })}
    </div>
  );
}
