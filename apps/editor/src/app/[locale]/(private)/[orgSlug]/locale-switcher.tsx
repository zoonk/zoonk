"use client";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

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
        <LanguagesIcon aria-hidden="true" />
        {t("Language")}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent>
        {SUPPORTED_LOCALES.map((lang) => (
          <DropdownMenuItem
            disabled={isPending}
            key={lang}
            onClick={() => onLocaleChange(lang)}
          >
            {LOCALE_LABELS[lang]}
            {lang === locale && (
              <CheckIcon aria-hidden="true" className="ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
