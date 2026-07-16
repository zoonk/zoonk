"use client";

import { type AppRoute, Link, useRouter } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd, type ShortcutKbdTone } from "@zoonk/ui/components/kbd";
import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";

type GenerationShortcutLinkVariant = "default" | "outline";
type GenerationShortcut = "Enter" | "Esc" | "N";

/**
 * Visible shortcut badges use compact labels like Esc and N, while keyboard
 * events and `aria-keyshortcuts` both need canonical key values.
 */
function getShortcutKey(shortcut: GenerationShortcut): string {
  if (shortcut === "Esc") {
    return "Escape";
  }

  if (shortcut === "N") {
    return "n";
  }

  return shortcut;
}

/**
 * Filled buttons need inverse shortcut text so the hint stays readable, while
 * outline buttons can use the normal muted shortcut style.
 */
function getShortcutTone(variant: GenerationShortcutLinkVariant): ShortcutKbdTone {
  if (variant === "default") {
    return "inverse";
  }

  return "default";
}

/**
 * Links remain real anchors for normal navigation and prefetching, while this
 * hook adds the matching keyboard path for users who prefer shortcuts.
 */
function useShortcutNavigation<Href extends string>({
  href,
  shortcutKey,
}: {
  href: AppRoute<Href>;
  shortcutKey?: string;
}) {
  const router = useRouter();

  useKeyboardCallback(
    shortcutKey ?? "",
    () => {
      if (!shortcutKey) {
        return false;
      }

      router.push(href);
    },
    { ignoreEditable: true, mode: "none" },
  );
}

/**
 * Renders focused empty-state actions with an optional visible keyboard
 * shortcut and a matching client-side keyboard navigation handler.
 */
export function GenerationShortcutLink<Href extends string>({
  children,
  className,
  href,
  prefetch,
  rel,
  shortcut,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  href: AppRoute<Href>;
  prefetch?: boolean;
  rel?: string;
  shortcut?: GenerationShortcut;
  variant?: GenerationShortcutLinkVariant;
}) {
  const shortcutKey = shortcut ? getShortcutKey(shortcut) : undefined;
  useShortcutNavigation({ href, shortcutKey });
  const shortcutTone = getShortcutTone(variant);

  return (
    <Link
      aria-keyshortcuts={shortcutKey}
      className={cn(buttonVariants({ variant }), "w-full", className)}
      href={href}
      prefetch={prefetch}
      rel={rel}
    >
      <span className="flex min-w-0 items-center justify-center gap-1.5">{children}</span>
      {shortcut && <ShortcutKbd tone={shortcutTone}>{shortcut}</ShortcutKbd>}
    </Link>
  );
}
