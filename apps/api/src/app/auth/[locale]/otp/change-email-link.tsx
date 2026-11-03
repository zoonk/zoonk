"use client";

import { OTP_LINK_CLASS } from "@/components/otp";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type getLoginHref } from "../../_utils/auth-redirect";

export function ChangeEmailLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: ReturnType<typeof getLoginHref>;
}) {
  const router = useRouter();

  useKeyboardCallback("Escape", () => router.push(href), { mode: "none" });

  return (
    <Link aria-keyshortcuts="Escape" className={OTP_LINK_CLASS} href={href}>
      {children}
      <ShortcutKbd>Esc</ShortcutKbd>
    </Link>
  );
}
