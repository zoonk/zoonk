import { readQueryParam } from "@/lib/query-param";
import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tab-class";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";

export type AdminTabOption = {
  /** How many wait in this view. Only for the view that is a to-do list. */
  count?: number;
  href: string;
  isActive: boolean;
  label: string;
};

type RecordTab<Value extends string> = { count?: number; label: string; value: Value };

/** The tab an address asks for, or the first one. */
export function readAdminTab<Value extends string>({
  tabs,
  value,
}: {
  tabs: readonly RecordTab<Value>[];
  value: string | string[] | undefined;
}): Value | undefined {
  const requested = readQueryParam(value);
  return (tabs.find((tab) => tab.value === requested) ?? tabs[0])?.value;
}

/**
 * A record's parts, one per `?tab=`: the first is the record's own address. They sit over a
 * hairline, which closes the record's header and tells them from a list's views further down.
 */
export function AdminRecordTabs<Value extends string>({
  current,
  label,
  path,
  tabs,
}: {
  current: Value | undefined;
  label: string;
  path: string;
  tabs: readonly RecordTab<Value>[];
}) {
  return (
    <div className="border-b pb-3">
      <AdminTabs
        label={label}
        options={tabs.map((tab, index) => ({
          count: tab.count,
          href: index === 0 ? path : `${path}?tab=${tab.value}`,
          isActive: tab.value === current,
          label: tab.label,
        }))}
      />
    </div>
  );
}

/**
 * A record's parts and a list's views. They are links, so each has an address, the server draws
 * only the open one, and only that one's data loads. A list's view that narrows it to what's
 * waiting comes first. The row reaches 10px past its column on both sides, so the first label
 * starts on the column's edge and the current tab's fill hangs past it like a highlighted row.
 */
export function AdminTabs({ label, options }: { label: string; options: AdminTabOption[] }) {
  return (
    <nav aria-label={label} className="min-w-0">
      <ul className={cn(TAB_LIST_CLASS, "-mx-2.5 -my-2 scrollbar-none overflow-x-auto py-2")}>
        {options.map((option) => (
          <li key={option.href}>
            <Link
              aria-current={option.isActive ? "page" : undefined}
              className={TAB_CLASS}
              href={option.href}
              prefetch
              scroll={false}
            >
              {option.label}
              {option.count ? (
                <span className="font-mono text-xs tabular-nums">
                  {option.count.toLocaleString("en")}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
