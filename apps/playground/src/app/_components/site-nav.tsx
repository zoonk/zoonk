import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";

const LINKS = [
  { href: "/design", id: "design", label: "Design system" },
  { href: "/", id: "player", label: "Player" },
] as const;

export function SiteNav({ current }: { current: (typeof LINKS)[number]["id"] }) {
  return (
    <nav aria-label="Playground" className="flex items-center gap-1">
      {LINKS.map((link) => (
        <Link
          aria-current={link.id === current ? "page" : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground hit-area relative rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
            link.id === current && "bg-muted text-foreground",
          )}
          href={link.href}
          key={link.id}
          prefetch
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
