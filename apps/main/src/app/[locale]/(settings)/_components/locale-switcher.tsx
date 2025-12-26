"use client";

import { Field, FieldContent, FieldLabel } from "@zoonk/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@zoonk/ui/components/native-select";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { useParams } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LocaleSwitcher() {
  const t = useExtracted();
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
    <Field>
      <FieldContent>
        <FieldLabel htmlFor="language">{t("Language")}</FieldLabel>
        <NativeSelect
          aria-label={t("Update language")}
          className="w-full sm:w-[280px]"
          defaultValue={locale}
          disabled={isPending}
          id="language"
          onChange={onSelectChange}
        >
          {SUPPORTED_LOCALES.map((lang) => (
            <NativeSelectOption key={lang} value={lang}>
              {LOCALE_LABELS[lang]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FieldContent>
    </Field>
  );
}
