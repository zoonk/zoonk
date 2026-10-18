import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";

/** A few fixed choices as links, so every view of the gallery is a URL to share or reopen. */
export function ToggleNav({
  label,
  options,
}: {
  label: string;
  options: { href: string; isActive: boolean; label: string }[];
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
