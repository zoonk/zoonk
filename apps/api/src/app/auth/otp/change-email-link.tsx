"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLoginHref } from "../_utils/auth-redirect";

/**
 * Lets keyboard users leave the OTP step without hunting for the secondary
 * action, while preserving the real anchor for normal click navigation.
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
    <Link
      aria-keyshortcuts="Escape"
      className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground w-full")}
      href={href}
    >
      {children}
      <ShortcutKbd>Esc</ShortcutKbd>
    </Link>
  );
}
