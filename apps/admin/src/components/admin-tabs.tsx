import { readQueryParam } from "@/lib/query-param";
import { TabLink, TabLinkCount, TabLinks } from "@zoonk/ui/components/tab-links";
import Link from "next/link";

export type AdminTabOption = {
  /** How many wait in this view. Only for the view that is a to-do list. */
  count?: number;
  href: string;
  isActive: boolean;
  label: string;
};

type RecordTab<Value extends string> = { label: string; value: Value };

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
 * waiting comes first.
 */
export function AdminTabs({ label, options }: { label: string; options: AdminTabOption[] }) {
  return (
    <TabLinks label={label}>
      {options.map((option) => (
        <TabLink
          current={option.isActive}
          key={option.href}
          render={<Link href={option.href} prefetch scroll={false} />}
        >
          {option.label}
          {option.count ? <TabLinkCount>{option.count.toLocaleString("en")}</TabLinkCount> : null}
        </TabLink>
      ))}
    </TabLinks>
  );
}
