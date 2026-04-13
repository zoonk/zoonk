/* oxlint-disable import/no-default-export -- shim must match next/image's default export */
/* oxlint-disable next/no-img-element -- test shim intentionally avoids next/image runtime */

import { type ComponentProps } from "react";

/**
 * Player browser tests only need image semantics. Using a plain img avoids the
 * Next.js image runtime while preserving accessible names and src assertions.
 */
export default function NextImage({
  alt,
  src,
  ...props
}: Omit<ComponentProps<"img">, "src"> & {
  alt: string;
  src: string;
}) {
  return <img {...props} alt={alt} src={src} />;
}
