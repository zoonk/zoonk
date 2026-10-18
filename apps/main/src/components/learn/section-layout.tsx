"use client";

import { usePathname } from "@/i18n/navigation";
import { LearnSectionBar } from "@zoonk/learn/bar";

/** Whether the page is one under the section's hub, which goes back to it. */
function usePageUnderHub(hub?: { href: string }): boolean {
  const pathname = usePathname();
  return Boolean(hub && pathname !== hub.href);
}

/** The section's bar: a page under the hub goes back to it and names it; the hub leaves the section. */
export function SectionBarFrame({
  backHref,
  className,
  end,
  hub,
}: {
  backHref: string;
  className?: string;
  end?: React.ReactNode;
  hub?: { href: string; title: string };
}) {
  const underHub = usePageUnderHub(hub);

  return (
    <LearnSectionBar
      backHref={backHref}
      className={className}
      end={end}
      parent={hub && underHub ? { href: hub.href, label: hub.title } : undefined}
      title={hub && !underHub ? hub.title : undefined}
    />
  );
}
