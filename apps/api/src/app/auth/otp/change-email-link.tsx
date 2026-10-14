"use client";

import { OTP_LINK_CLASS } from "@/components/otp";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLoginHref } from "../_utils/auth-redirect";

/**
 * Lets keyboard users leave the OTP step without hunting for the secondary
 * action (Escape), while preserving the real anchor for normal click navigation.
 */
export function ChangeEmailLink({
  children,
  redirectTo,
}: {
  children: React.ReactNode;
  redirectTo: string | null;
}) {
  const href = getLoginHref(redirectTo);
  const router = useRouter();

  useKeyboardCallback("Escape", () => router.push(href), { mode: "none" });

  return (
    <Link aria-keyshortcuts="Escape" className={OTP_LINK_CLASS} href={href}>
      {children}
      <ShortcutKbd>Esc</ShortcutKbd>
    </Link>
  );
}
