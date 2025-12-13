"use client";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const localeNames: Record<string, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

export function LocaleSwitcher() {
  const t = useExtracted();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function onLocaleChange(nextLocale: string) {
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { params, pathname },
        { locale: nextLocale },
      );
    });
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2" disabled={isPending}>
        <LanguagesIcon aria-hidden="true" className="size-4" />
        {t("Language")}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent>
        {routing.locales.map((lang) => (
          <DropdownMenuItem
            disabled={isPending}
            key={lang}
            onClick={() => onLocaleChange(lang)}
          >
            {localeNames[lang] ?? lang}
            {lang === locale && (
              <CheckIcon aria-hidden="true" className="ml-auto size-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
