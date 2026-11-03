"use client";

import { getPathname, usePathname } from "@/i18n/navigation";
import { useAppLocale } from "@zoonk/learn/locale";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { useSearchParams } from "next/navigation";
import { type ComponentProps, Suspense } from "react";

type LoginLinkProps = Omit<ComponentProps<typeof PendingLink>, "href">;

function CurrentPageLink(props: LoginLinkProps) {
  const locale = useAppLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loginPath = getPathname({ href: "/login", locale });

  const returnPath = getPathname({ href: pathname, locale });
  const query = searchParams.toString();
  const next = query ? `${returnPath}?${query}` : returnPath;

  return <PendingLink {...props} href={`${loginPath}?next=${encodeURIComponent(next)}`} />;
}

export function CurrentPageLoginLink(props: LoginLinkProps) {
  const locale = useAppLocale();

  return (
    <Suspense fallback={<PendingLink {...props} href={getPathname({ href: "/login", locale })} />}>
      <CurrentPageLink {...props} />
    </Suspense>
  );
}
