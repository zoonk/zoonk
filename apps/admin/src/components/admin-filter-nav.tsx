import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";

export type AdminFilterOption = {
  /** How many wait in this view. Only for the view that is a to-do list. */
  count?: number;
  href: string;
  isActive: boolean;
  label: string;
};

/** A list's views, as links: the one that narrows it to what's waiting comes first. */
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
          {option.count ? (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {option.count.toLocaleString("en")}
            </span>
          ) : null}
        </Button>
      ))}
    </nav>
  );
}
