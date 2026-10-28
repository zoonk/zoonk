import { Link } from "@/i18n/navigation";
import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { PUBLIC_CONTAINER_CLASS } from "./landing-styles";
import { PublicTopBarSurface } from "./public-top-bar-surface";

const BRAND_NAME = "Zoonk";

/** Named by the brand it shows, so screen readers and voice control call it what the page calls it. */
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

/** Pages that never show the account menu use it directly, so its code never ships to them. */
export function PublicTopBar({ actions, start }: { actions: ReactNode; start?: ReactNode }) {
  return (
    <PublicTopBarSurface>
      <div className={cn(PUBLIC_CONTAINER_CLASS, "flex h-14 items-center gap-8 sm:h-[72px]")}>
        <div className="flex min-w-0 items-center">{start ?? <PublicHomeLink />}</div>
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </PublicTopBarSurface>
  );
}
