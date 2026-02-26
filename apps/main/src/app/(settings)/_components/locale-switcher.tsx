"use client";

import { usePathname, useRouter } from "next/navigation";
import { Field, FieldContent, FieldLabel } from "@zoonk/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { useExtracted, useLocale } from "next-intl";
import { useTransition } from "react";

export function LocaleSwitcher() {
  const t = useExtracted();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();

  function onSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=31536000`;

    startTransition(() => {
      router.replace(pathname);
      router.refresh();
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
