"use client";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import Cookies from "js-cookie";
import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import { useTransition } from "react";

export function LocaleSwitcher() {
  const t = useExtracted();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onLocaleChange(nextLocale: string) {
    Cookies.set("locale", nextLocale, { expires: 365, sameSite: "lax" });

    startTransition(() => {
      router.refresh();
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
            aria-current={lang === locale ? "true" : undefined}
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
