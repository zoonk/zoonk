/* oxlint-disable import/no-default-export -- shim must match next/image's default export */
/* oxlint-disable next/no-img-element -- test shim intentionally avoids next/image runtime */

import { type ComponentProps } from "react";

/**
 * Player browser tests only need image semantics. Using a plain img avoids the
 * Next.js image runtime while preserving accessible names and src assertions, and drops the
 * loading options only next/image understands.
 */
export default function NextImage({
  alt,
  fill,
  preload: _preload,
  priority: _priority,
  src,
  style,
  unoptimized: _unoptimized,
  ...props
}: Omit<ComponentProps<"img">, "src"> & {
  alt: string;
  fill?: boolean;
  preload?: boolean;
  priority?: boolean;
  src: string;
  unoptimized?: boolean;
}) {
  const fillStyle = fill
    ? { height: "100%", inset: 0, position: "absolute" as const, width: "100%" }
    : undefined;

  return <img {...props} alt={alt} src={src} style={{ ...fillStyle, ...style }} />;
}
