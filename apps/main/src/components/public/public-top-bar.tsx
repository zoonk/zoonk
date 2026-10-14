import { Link } from "@/i18n/navigation";
import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { PUBLIC_CONTAINER_CLASS } from "./landing-styles";

/** The product's name, the same in every language. */
const BRAND_NAME = "Zoonk";

/**
 * The brain, going home: the public pages' only logo. It's named by the brand it shows, so
 * screen readers and voice control call it what the page calls it.
 */
export function PublicHomeLink() {
  return (
    <Link
      aria-label={BRAND_NAME}
      className="focus-visible:ring-ring/50 -m-2.5 flex items-center rounded-xl p-2.5 outline-none focus-visible:ring-[3px]"
      href="/"
    >
      <ZoonkLogo className="size-6" />
    </Link>
  );
}

/**
 * The public top bar: the brain goes home (or what `start` puts there instead), and the page's
 * actions on the right, on the public pages' one container. Pages that never show the account menu
 * (the visitor home) use it directly, so its code never ships to them; the others use
 * `PublicHeader`.
 */
export function PublicTopBar({
  actions,
  className,
  start,
}: {
  actions: ReactNode;
  className?: string;
  start?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "bg-background/85 supports-backdrop-filter:bg-background/70 sticky top-0 z-40 backdrop-blur-md",
        className,
      )}
    >
      <div className={cn(PUBLIC_CONTAINER_CLASS, "flex h-14 items-center gap-8 sm:h-[72px]")}>
        <div className="flex min-w-0 items-center">{start ?? <PublicHomeLink />}</div>
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
