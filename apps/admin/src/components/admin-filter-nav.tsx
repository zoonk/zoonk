import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";

export type AdminFilterOption = { href: string; isActive: boolean; label: string };

export function AdminFilterNav({
  label,
  options,
}: {
  label: string;
  options: AdminFilterOption[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-0.5">
      {options.map((option) => (
        <Button
          key={option.href}
          nativeButton={false}
          render={
            <Link aria-current={option.isActive ? "page" : undefined} href={option.href} prefetch />
          }
          size="sm"
          variant={option.isActive ? "secondary" : "ghost"}
        >
          {option.label}
        </Button>
      ))}
    </nav>
  );
}
