"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { useScrollDirection } from "@zoonk/ui/hooks/use-scroll-direction";
import { cn } from "@zoonk/ui/lib/utils";
import { Ellipsis, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ClientLink } from "@/i18n/client-link";
import { Link, usePathname } from "@/i18n/navigation";

type TabBarProps = {
  children: React.ReactNode;
  /** Right action element (e.g., search, close button) */
  action?: React.ReactNode;
  className?: string;
};

export function TabBar({ children, action, className }: TabBarProps) {
  const { scrollDirection, isAtTop } = useScrollDirection({ threshold: 10 });

  const isVisible = scrollDirection === "up" || isAtTop;

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out",
        isVisible ? "translate-y-0" : "translate-y-full",
        className,
      )}
    >
      <nav className="flex items-center gap-1 rounded-full border border-border bg-background/80 p-1.5 shadow-lg backdrop-blur-md">
        {children}
      </nav>

      {action && (
        <div className="flex items-center rounded-full border border-border bg-background/80 p-1.5 shadow-lg backdrop-blur-md">
          {action}
        </div>
      )}
    </div>
  );
}

type TabBarItemProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  /** If true, matches exact path. If false, matches path prefix. */
  exact?: boolean;
};

function isActive(href: string, pathname: string, exact: boolean): boolean {
  if (exact) {
    return href === pathname;
  }
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
}

export function TabBarItem({
  href,
  icon,
  label,
  exact = false,
}: TabBarItemProps) {
  const pathname = usePathname();
  const active = isActive(href, pathname, exact);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({
          size: "icon",
          variant: active ? "default" : "ghost",
        }),
        "rounded-full",
      )}
      href={href}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </Link>
  );
}

type OverflowTriggerProps = {
  pages: string[];
};

export function TabOverflow({ children }: React.ComponentProps<"div">) {
  return <DropdownMenu>{children}</DropdownMenu>;
}

export function TabOverflowTrigger({ pages }: OverflowTriggerProps) {
  const t = useExtracted();
  const pathname = usePathname();

  const isOverflowActive = pages.some((page) => pathname.startsWith(page));

  return (
    <DropdownMenuTrigger
      className={cn(
        buttonVariants({
          size: "icon",
          variant: isOverflowActive ? "default" : "ghost",
        }),
        "rounded-full md:hidden",
      )}
    >
      <Ellipsis aria-hidden="true" />
      <span className="sr-only">{t("See more")}</span>
    </DropdownMenuTrigger>
  );
}

export function TabOverflowMenu({ children }: React.ComponentProps<"div">) {
  return (
    <DropdownMenuContent align="end" side="top">
      {children}
    </DropdownMenuContent>
  );
}

type OverflowItemProps = {
  url: string;
  label: string;
  icon: React.ReactNode;
};

export function TabOverflowIMenutem({ url, label, icon }: OverflowItemProps) {
  return (
    <DropdownMenuItem asChild>
      <ClientLink href={url}>
        {icon} {label}
      </ClientLink>
    </DropdownMenuItem>
  );
}

type TabBarCloseActionProps = {
  url?: string;
  label?: string;
};

export function TabBarCloseAction({
  url = "/",
  label,
}: TabBarCloseActionProps) {
  const t = useExtracted();

  return (
    <Link
      className={buttonVariants({ size: "icon", variant: "ghost" })}
      href={url}
    >
      <XIcon aria-hidden="true" />
      <span className="sr-only">{label ?? t("Home")}</span>
    </Link>
  );
}
