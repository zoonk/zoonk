import { type AdminFilterOption } from "@/components/admin-filter-nav";

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

export const VISIBILITY_FILTER_OPTIONS = [
  { label: "Public", value: "public" as const },
  { label: "Private", value: "private" as const },
];
