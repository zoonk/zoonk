"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted, useLocale } from "next-intl";
import { useActionState } from "react";
import { startLanguageCourse } from "./actions";

export function CreateLanguageCourse({ language }: { language: string }) {
  const t = useExtracted();
  const locale = useLocale();

  const [state, action, pending] = useActionState(startLanguageCourse.bind(null, locale), {
    error: false,
  });

  return (
    <form action={action} className="flex w-full flex-col items-start gap-3">
      <input name="language" type="hidden" value={language} />
      <Button aria-busy={pending} disabled={pending} type="submit">
        {pending && <Spinner />}
        {t("Create course")}
      </Button>
      {state.error && (
        <p className="text-destructive text-sm" role="alert">
          {t("Couldn't start this course. Please try again.")}
        </p>
      )}
    </form>
  );
}
