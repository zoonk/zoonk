import { readQueryParam } from "@/lib/query-param";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";

type AdminTab<Value extends string> = { label: string; value: Value };

/** The tab an address asks for, or the first one. */
export function readAdminTab<Value extends string>({
  tabs,
  value,
}: {
  tabs: readonly AdminTab<Value>[];
  value: string | string[] | undefined;
}): Value | undefined {
  const requested = readQueryParam(value);
  return (tabs.find((tab) => tab.value === requested) ?? tabs[0])?.value;
}

/**
 * A detail page's parts, one per `?tab=`. They are links, so a tab has an address, the server
 * draws only the open one, and only that one's data loads. The first tab is the page's own address.
 */
export function AdminTabs<Value extends string>({
  current,
  label,
  path,
  tabs,
}: {
  current: Value | undefined;
  label: string;
  path: string;
  tabs: readonly AdminTab<Value>[];
}) {
  return (
    <nav aria-label={label} className="-mb-2 flex gap-5 overflow-x-auto border-b">
      {tabs.map((tab, index) => (
        <Link
          aria-current={tab.value === current ? "page" : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground hit-area relative -mb-px flex h-10 shrink-0 items-center border-b-2 border-transparent text-sm font-medium transition-colors",
            "aria-[current=page]:border-foreground aria-[current=page]:text-foreground",
            "focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-[3px]",
          )}
          href={index === 0 ? path : `${path}?tab=${tab.value}`}
          key={tab.value}
          prefetch
          scroll={false}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
