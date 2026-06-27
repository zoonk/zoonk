"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Builds the internal login route once so the link href and Escape shortcut
 * always send users back to the same place.
 */
function getChangeEmailHref(redirectTo: string) {
  const params = new URLSearchParams({ redirectTo });
  return `/auth/login?${params.toString()}` as const;
}

/**
 * Lets keyboard users leave the OTP step without hunting for the secondary
 * action, while preserving the real anchor for normal click navigation.
 */
export function ChangeEmailLink({
  children,
  redirectTo,
}: {
  children: React.ReactNode;
  redirectTo: string;
}) {
  const href = getChangeEmailHref(redirectTo);
  const router = useRouter();

  useKeyboardCallback("Escape", () => router.push(href), { mode: "none" });

  return (
    <Link
      aria-keyshortcuts="Escape"
      className={cn(buttonVariants({ variant: "outline" }), "w-full")}
      href={href}
    >
      {children}
      <ShortcutKbd>Esc</ShortcutKbd>
    </Link>
  );
}
