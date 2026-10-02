import { ZoonkLogo } from "@/components/brand/zoonk-logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

/**
 * The public top bar: the brain goes home, the page's navigation, and its actions on the right.
 * Pages that never show the account menu (the visitor home) use it directly, so its code never
 * ships to them; the others use `PublicHeader`.
 */
export async function PublicTopBar({
  actions,
  className,
  navigation,
}: {
  actions: ReactNode;
  className?: string;
  navigation?: ReactNode;
}) {
  const t = await getExtracted();

  return (
    <header
      className={cn(
        "bg-background/85 supports-backdrop-filter:bg-background/70 sticky top-0 z-40 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4 sm:h-[72px] sm:px-8">
        <Link
          className="focus-visible:ring-ring/50 -m-2 rounded-xl p-2 outline-none focus-visible:ring-[3px]"
          href="/"
        >
          <ZoonkLogo className="size-7" label={t("Zoonk home page")} />
        </Link>

        {navigation}

        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
