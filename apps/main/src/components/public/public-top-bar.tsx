import { Link } from "@/i18n/navigation";
import { ZoonkLogo } from "@zoonk/ui/components/zoonk-logo";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

/** The brain, going home: the public pages' and the login's only logo. */
export async function PublicHomeLink() {
  const t = await getExtracted();

  return (
    <Link
      className="focus-visible:ring-ring/50 -m-2 rounded-xl p-2 outline-none focus-visible:ring-[3px]"
      href="/"
    >
      <ZoonkLogo className="size-7" label={t("Zoonk home page")} />
    </Link>
  );
}

/**
 * The public top bar: the brain goes home (or what `start` puts there instead), the page's
 * navigation, and its actions on the right. Pages that never show the account menu (the visitor
 * home) use it directly, so its code never ships to them; the others use `PublicHeader`.
 */
export function PublicTopBar({
  actions,
  className,
  navigation,
  start,
}: {
  actions: ReactNode;
  className?: string;
  navigation?: ReactNode;
  start?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "bg-background/85 supports-backdrop-filter:bg-background/70 sticky top-0 z-40 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:h-[72px] sm:px-8">
        <div className="flex min-w-0 items-center">{start ?? <PublicHomeLink />}</div>

        {navigation}

        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
