"use client";

import { usePathname } from "@/i18n/navigation";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { LearnShellMain } from "@zoonk/learn/shell";
import { cn } from "@zoonk/ui/lib/utils";

/** A section's hub (its first page) and the sidebar of its pages. */
export type SectionHub = { href: string; nav: React.ReactNode; title: string };

/** Whether the page is one under the section's hub, which goes back to it. */
function usePageUnderHub(hub?: { href: string }): boolean {
  const pathname = usePathname();
  return Boolean(hub && pathname !== hub.href);
}

/** The section's bar: a page under the hub goes back to it and names it; the hub leaves the section. */
export function SectionBarFrame({
  backHref,
  end,
  home,
  hub,
  wide,
}: {
  backHref: string;
  end?: React.ReactNode;
  home?: boolean;
  hub?: { href: string; title: string };
  wide?: boolean;
}) {
  const underHub = usePageUnderHub(hub);

  return (
    <LearnSectionBar
      backHref={backHref}
      end={end}
      home={home}
      parent={hub && underHub ? { href: hub.href, label: hub.title } : undefined}
      title={hub && !underHub ? hub.title : undefined}
      wide={wide}
    />
  );
}

/**
 * The section's page: the app's column on phones, and from `lg` the section's pages in a sidebar
 * beside it, on the hub too (its first page, the statistics' overview or the profile, sits beside
 * them there).
 */
export function SectionMain({
  children,
  hub,
  wide,
}: {
  children: React.ReactNode;
  hub?: SectionHub;
  wide?: boolean;
}) {
  if (!hub) {
    return (
      <LearnShellMain className={cn(wide && "max-w-none sm:px-6 lg:px-8")}>
        {children}
      </LearnShellMain>
    );
  }

  return (
    <LearnShellMain className="lg:max-w-5xl lg:px-6">
      <div className="flex flex-col lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-12">
        <aside className="hidden lg:sticky lg:top-24 lg:block">{hub.nav}</aside>
        <div className="flex min-w-0 flex-col lg:max-w-160">{children}</div>
      </div>
    </LearnShellMain>
  );
}
