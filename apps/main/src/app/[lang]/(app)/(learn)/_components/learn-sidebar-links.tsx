"use client";

import { openCommandPalette } from "@/app/[lang]/(app)/(catalog)/_components/command-palette-event";
import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { useContentFeedback } from "@zoonk/learn/feedback";
import { SIDEBAR_COUNT_CLASS, SIDEBAR_ITEM_CLASS } from "@zoonk/ui/components/sidebar";
import { SidebarSearch, SidebarTooltip } from "@zoonk/ui/components/sidebar-toggle";
import { MessageSquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense } from "react";

export function LearnSidebarSearch({
  className,
  placement,
}: {
  className?: string;
  placement?: "bar" | "sidebar";
}) {
  const t = useExtracted();

  return (
    <SidebarSearch
      className={className}
      label={t("Search or ask…")}
      onClick={openCommandPalette}
      placement={placement}
    />
  );
}

export function LearnSidebarFeedback() {
  const t = useExtracted();
  const feedback = useContentFeedback();
  const label = t("Send feedback");

  return (
    <SidebarTooltip label={label}>
      <button
        aria-haspopup="dialog"
        className={SIDEBAR_ITEM_CLASS}
        onClick={() =>
          feedback?.openFeedbackForm({ context: { screen: "sidebar" }, isReport: false })
        }
        type="button"
      >
        <MessageSquareIcon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      </button>
    </SidebarTooltip>
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

  const countMark = Boolean(count) && <span className={SIDEBAR_COUNT_CLASS}>{count}</span>;

  return (
    <SidebarTooltip
      label={
        <>
          {label}
          {countMark}
        </>
      }
    >
      <Link
        aria-current={current ? "page" : undefined}
        className={SIDEBAR_ITEM_CLASS}
        href={href}
        prefetch
      >
        <Icon aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {countMark}
      </Link>
    </SidebarTooltip>
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
