"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { getLanguageName } from "@zoonk/utils/languages";
import { useExtracted, useLocale } from "next-intl";
import { useActionState } from "react";
import { type CourseEditionActionState, resolveCourseEditionAction } from "./course-edition-action";

const INITIAL_STATE: CourseEditionActionState = { status: "idle" };

/**
 * A document navigation lets the proxy persist the explicit language before
 * canonicalizing English, without retaining the server action's old locale.
 */
async function submitCourseEdition(previousState: CourseEditionActionState, formData: FormData) {
  const result = await resolveCourseEditionAction(previousState, formData);

  if (result.status === "redirect") {
    globalThis.location.assign(result.href);
  }

  return result;
}

function CourseEditionSubmitLabel({
  failed,
  language,
  pending,
}: {
  failed: boolean;
  language: string;
  pending: boolean;
}) {
  const t = useExtracted();

  if (pending) {
    return t("Finding your course…");
  }

  if (failed) {
    return t("Try again");
  }

  return t("Learn in {language}", { language });
}

export function CourseEditionForm({
  brandSlug,
  compact,
  courseId,
  courseSlug,
  failed,
  targetLocale,
}: {
  brandSlug: string;
  compact: boolean;
  courseId: string;
  courseSlug: string;
  failed: boolean;
  targetLocale: string;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const language = getLanguageName({ targetLanguage: targetLocale, userLanguage: locale });
  const [state, formAction, isPending] = useActionState(submitCourseEdition, INITIAL_STATE);
  const pending = isPending || state.status === "redirect";

  if (state.status === "unsupported") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("This course isn't available in {language} yet.", { language })}
      </p>
    );
  }

  return (
    <form action={formAction} aria-busy={pending} className="flex w-full flex-col gap-3">
      <input name="brandSlug" type="hidden" value={brandSlug} />
      <input name="courseId" type="hidden" value={courseId} />
      <input name="courseSlug" type="hidden" value={courseSlug} />
      <input name="language" type="hidden" value={targetLocale} />

      {state.status === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {t("We couldn't prepare your course. Please try again.")}
        </p>
      )}

      <Button
        className="h-auto min-h-11 w-full whitespace-normal"
        disabled={pending}
        type="submit"
        variant={compact ? "outline" : "default"}
      >
        {pending && <Spinner />}
        <CourseEditionSubmitLabel
          failed={failed || state.status === "error"}
          language={language}
          pending={pending}
        />
      </Button>
    </form>
  );
}
