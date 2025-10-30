"use client";

import {
  NativeSelect,
  NativeSelectOption,
} from "@zoonk/ui/components/native-select";
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

  function onSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;

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
    <NativeSelect
      aria-label={t("label")}
      className="w-[180px]"
      defaultValue={locale}
      disabled={isPending}
      onChange={onSelectChange}
    >
      {routing.locales.map((lang) => (
        <NativeSelectOption key={lang} value={lang}>
          {t("locale", { locale: lang })}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
