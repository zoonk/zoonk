/* oxlint-disable import/no-default-export -- shim must match next/link's default export */

import { type ComponentProps } from "react";

/**
 * Browser integration tests run the shared player outside a Next.js router.
 * This shim keeps link rendering semantic so tests can assert public hrefs.
 */
export default function NextLink({
  children,
  href,
  prefetch: _prefetch,
  ...props
}: Omit<ComponentProps<"a">, "href"> & {
  href: string | URL;
  prefetch?: boolean;
}) {
  return (
    <a {...props} href={typeof href === "string" ? href : href.toString()}>
      {children}
    </a>
  );
}
