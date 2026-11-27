"use client";

import { getPathname, usePathname } from "@/i18n/navigation";
import { useAppLocale } from "@zoonk/learn/locale";
import { DocumentLink, PendingLink } from "@zoonk/ui/patterns/links/pending";
import { useSearchParams } from "next/navigation";
import { type ComponentProps, type ComponentType, Suspense } from "react";

type AnchorProps = ComponentProps<"a">;
type Anchor = ComponentType<AnchorProps>;
type LoginLinkProps = Omit<ComponentProps<typeof PendingLink>, "href">;

function CurrentPageLink({ link: Link, ...props }: AnchorProps & { link: Anchor }) {
  const locale = useAppLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loginPath = getPathname({ href: "/login", locale });

  const returnPath = getPathname({ href: pathname, locale });
  const query = searchParams.toString();
  const next = query ? `${returnPath}?${query}` : returnPath;

  return <Link {...props} href={`${loginPath}?next=${encodeURIComponent(next)}`} />;
}

function LoginLink({ link: Link, ...props }: AnchorProps & { link: Anchor }) {
  const locale = useAppLocale();

  return (
    <Suspense fallback={<Link {...props} href={getPathname({ href: "/login", locale })} />}>
      <CurrentPageLink {...props} link={Link} />
    </Suspense>
  );
}

export function CurrentPageLoginLink(props: LoginLinkProps) {
  return <LoginLink {...props} link={PendingLink} />;
}

/**
 * The same link as a bare anchor, for `EnterLink`, which draws its content: the `href` it's given
 * gives way to the login that comes back to this page.
 */
export function CurrentPageLoginAnchor(props: AnchorProps) {
  return <LoginLink {...props} link={DocumentLink} />;
}
