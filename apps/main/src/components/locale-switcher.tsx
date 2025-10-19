"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zoonk/ui/components/select";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const params = useParams();

  function onSelectChange(nextLocale: string) {
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname, params },
        { locale: nextLocale },
      );
    });
  }

  return (
    <Select
      defaultValue={locale}
      disabled={isPending}
      onValueChange={onSelectChange}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={t("label")} />
      </SelectTrigger>

      <SelectContent>
        {routing.locales.map((lang) => (
          <SelectItem key={lang} value={lang}>
            {t("locale", { locale: lang })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
