import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";

export type AdminFilterOption = { href: string; isActive: boolean; label: string };

/**
 * Admin lists switch between a few fixed filter values (status, kind, vote)
 * with links, so filtered views stay server-rendered and shareable.
 */
export function AdminFilterNav({
  label,
  options,
}: {
  label: string;
  options: AdminFilterOption[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => (
        <Button
          key={option.href}
          nativeButton={false}
          render={
            <Link aria-current={option.isActive ? "page" : undefined} href={option.href} prefetch />
          }
          size="sm"
          variant={option.isActive ? "default" : "outline"}
        >
          {option.label}
        </Button>
      ))}
    </nav>
  );
}
