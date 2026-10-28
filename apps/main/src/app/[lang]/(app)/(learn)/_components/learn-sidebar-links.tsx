"use client";

import { openCommandPalette } from "@/app/[lang]/(app)/(catalog)/_components/command-palette-event";
import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { LEARN_SIDEBAR_ITEM_CLASS } from "@zoonk/learn/shell";
import { Kbd } from "@zoonk/ui/components/kbd";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { cn } from "@zoonk/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense } from "react";

/** Apple's label until mounted, so it matches the server's. */
function useShortcutLabel() {
  const isMounted = useIsMounted();
  const isApple = !isMounted || /Mac|iPhone|iPad|iPod/u.test(navigator.userAgent);

  return isApple ? "⌘K" : "Ctrl K";
}

const SEARCH_CLASS = {
  bar: "h-10 rounded-[0.625rem] px-3 text-sm hover:bg-muted/60",
  sidebar: "h-8 rounded-lg px-2.5 text-[0.8125rem] hover:bg-sidebar-accent/70",
} as const;

export function LearnSidebarSearch({
  className,
  placement = "sidebar",
}: {
  className?: string;
  placement?: keyof typeof SEARCH_CLASS;
}) {
  const t = useExtracted();
  const shortcut = useShortcutLabel();

  return (
    <button
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "text-faint ring-input hover:text-foreground focus-visible:ring-ring/50 hit-area relative flex w-full items-center gap-2 ring-1 transition-colors outline-none ring-inset focus-visible:ring-[3px]",
        SEARCH_CLASS[placement],
        className,
      )}
      onClick={openCommandPalette}
      type="button"
    >
      <SearchIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">{t("Search or ask…")}</span>
      <Kbd aria-hidden="true" className="hidden pointer-fine:inline-flex">
        {shortcut}
      </Kbd>
    </button>
  );
}

type SidebarMenu = "exam" | "mindMaps" | "mistakes" | "speaking" | "stats";

const ALSO_CURRENT: Partial<Record<SidebarMenu, string[]>> = {
  exam: ["/mock/new"],
  stats: [
    getMenu("activity").url,
    getMenu("energy").url,
    getMenu("level").url,
    getMenu("patterns").url,
    getMenu("score").url,
  ],
};

function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarLinkProps = { count?: number; label: string; menu: SidebarMenu };

function SidebarLinkView({ count, current, label, menu }: SidebarLinkProps & { current: boolean }) {
  const { icon: Icon, url: href } = getMenu(menu);

  return (
    <Link
      aria-current={current ? "page" : undefined}
      className={LEARN_SIDEBAR_ITEM_CLASS}
      href={href}
      prefetch
    >
      <Icon aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {Boolean(count) && (
        // On the current item's fill a faint count would drop under AA.
        <span className="text-faint in-aria-[current=page]:text-muted-foreground font-mono text-xs tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}

function CurrentSidebarLink(props: SidebarLinkProps) {
  const pathname = usePathname();
  const { url: href } = getMenu(props.menu);
  const current = [href, ...(ALSO_CURRENT[props.menu] ?? [])].some((url) => isUnder(pathname, url));

  return <SidebarLinkView {...props} current={current} />;
}

/** A page whose path is only known once it's open shows the link unmarked until then. */
export function LearnSidebarLink(props: SidebarLinkProps) {
  return (
    <Suspense fallback={<SidebarLinkView {...props} current={false} />}>
      <CurrentSidebarLink {...props} />
    </Suspense>
  );
}
