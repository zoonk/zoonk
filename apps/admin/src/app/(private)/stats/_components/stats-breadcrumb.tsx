import { AdminBreadcrumb } from "@/components/admin-breadcrumb";

export type StatsBreadcrumbItem = { href?: string; label: string };

const ROOT: StatsBreadcrumbItem[] = [
  { href: "/", label: "Home" },
  { href: "/stats", label: "Stats" },
];

export function StatsBreadcrumb({ items }: { items?: StatsBreadcrumbItem[] }) {
  const trail = [...ROOT, ...(items ?? [])];

  return (
    <AdminBreadcrumb
      current={trail.at(-1)?.label}
      parents={trail
        .slice(0, -1)
        .flatMap((item) => (item.href ? [{ href: item.href, label: item.label }] : []))}
    />
  );
}
