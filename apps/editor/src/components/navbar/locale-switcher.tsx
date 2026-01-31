"use client";

import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { setCookie } from "@zoonk/utils/cookies";
import { LOCALE_COOKIE, LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";

export function LocaleSwitcher() {
  const t = useExtracted();
  const locale = useLocale();

  function onLocaleChange(nextLocale: string) {
    setCookie(LOCALE_COOKIE, nextLocale, { expires: 365, sameSite: "lax" });
    globalThis.location.reload();
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <LanguagesIcon aria-hidden="true" />
        {t("Language")}
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent>
        {SUPPORTED_LOCALES.map((lang) => (
          <DropdownMenuItem
            aria-current={lang === locale ? "true" : undefined}
            key={lang}
            onClick={() => onLocaleChange(lang)}
          >
            {LOCALE_LABELS[lang]}
            {lang === locale && <CheckIcon aria-hidden="true" className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
