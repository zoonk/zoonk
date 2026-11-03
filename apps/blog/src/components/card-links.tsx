import { type LucideIcon } from "lucide-react";

export function CardLinks({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <nav aria-label={label} className="not-prose text-foreground my-8">
      <ul className="grid grid-cols-2 gap-3">{children}</ul>
    </nav>
  );
}

export function CardLink({
  children,
  href,
  icon: Icon,
}: {
  children: React.ReactNode;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <li className="flex">
      <a
        className="bg-card ring-border hover:bg-muted focus-visible:ring-ring/50 press flex w-full items-center gap-3 rounded-xl p-4 font-semibold tracking-tight ring-1 transition-colors outline-none focus-visible:ring-[3px]"
        href={href}
      >
        <Icon aria-hidden="true" className="text-muted-foreground size-4.5 shrink-0" />
        {children}
      </a>
    </li>
  );
}
