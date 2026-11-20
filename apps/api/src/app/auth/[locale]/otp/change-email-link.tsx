"use client";

import { OTP_LINK_CLASS } from "@/components/otp";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import Link from "next/link";
import { type getLoginHref } from "../../_utils/auth-redirect";

export function ChangeEmailLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: ReturnType<typeof getLoginHref>;
}) {
  const ref = useEscapeClick<HTMLAnchorElement>({ fromField: true });

  return (
    <Link
      aria-keyshortcuts={shortcutKeys("leave")}
      className={OTP_LINK_CLASS}
      href={href}
      ref={ref}
    >
      {children}
      <ShortcutKbd shortcut="leave" />
    </Link>
  );
}
