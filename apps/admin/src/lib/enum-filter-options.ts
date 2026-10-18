import { type AdminFilterOption } from "@/components/admin-filter-nav";

/**
 * Link options for a small enum filter: "all" first, then one per value. The
 * caller builds each href so the other filters in the URL are kept.
 */
export function buildEnumFilterOptions<Value extends string>({
  allLabel,
  buildHref,
  current,
  options,
}: {
  allLabel: string;
  buildHref: (value?: Value) => string;
  current: Value | undefined;
  options: { label: string; value: Value }[];
}): AdminFilterOption[] {
  return [
    { href: buildHref(), isActive: current === undefined, label: allLabel },
    ...options.map((option) => ({
      href: buildHref(option.value),
      isActive: current === option.value,
      label: option.label,
    })),
  ];
}

/** Public and private Library content share one filter vocabulary. */
export const VISIBILITY_FILTER_OPTIONS = [
  { label: "Public", value: "public" as const },
  { label: "Private", value: "private" as const },
];
