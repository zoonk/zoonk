import { badgeVariants } from "@zoonk/ui/components/badge";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type LanguageFilterProps = {
  currentLocale: string;
  orgSlug: string;
};

export async function LanguageFilter({
  currentLocale,
  orgSlug,
}: LanguageFilterProps) {
  const t = await getExtracted();

  return (
    <nav
      aria-label={t("Filter by language")}
      className="flex items-center gap-1"
    >
      {routing.locales.map((locale) => {
        const isActive = locale === currentLocale;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              badgeVariants({ variant: isActive ? "default" : "outline" }),
              "uppercase",
            )}
            href={`/editor/${orgSlug}`}
            key={locale}
            locale={locale}
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}
