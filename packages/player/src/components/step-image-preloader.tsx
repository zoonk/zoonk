"use client";

import Image from "next/image";
import { Activity } from "react";
import { SELECT_IMAGE_PROPS, STEP_IMAGE_PROPS } from "../image-config";
import { type PreloadableImage } from "../player-selectors";

/**
 * Renders hidden Next.js `<Image>` components for upcoming steps so the browser
 * fetches the optimized `/_next/image` URLs before the user navigates to them.
 * When the real step mounts with the same props, the browser serves the image
 * from its HTTP cache — making it appear instantly.
 *
 * Uses React's `<Activity mode="hidden">` to render at lower priority
 * (doesn't compete with the current step) while keeping DOM nodes alive
 * so `loading="eager"` can trigger the fetch.
 */
export function StepImagePreloader({ images }: { images: PreloadableImage[] }) {
  if (images.length === 0) {
    return null;
  }

  return (
    <Activity mode="hidden">
      {images.map((image) => {
        const props = image.kind === "step" ? STEP_IMAGE_PROPS : SELECT_IMAGE_PROPS;
        return <Image alt="" key={image.url} loading="eager" src={image.url} {...props} />;
      })}
    </Activity>
  );
}
