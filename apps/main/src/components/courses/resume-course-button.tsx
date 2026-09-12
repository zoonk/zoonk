"use client";

import { runClientAction } from "@/lib/client-action";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted, useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { resumeCourse } from "./resume-course-action";

export function ResumeCourseButton({ courseId }: { courseId: string }) {
  const t = useExtracted();
  const language = useLocale();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <Button
        aria-busy={pending}
        className="min-h-11"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setStatus(undefined);

            const result = await runClientAction(() => resumeCourse({ courseId, language }), {
              status: "unavailable" as const,
            });

            setStatus(result.status);
          })
        }
      >
        {pending && <Spinner aria-hidden="true" />}
        {t("Continue")}
      </Button>
      {status && (
        <p className="text-destructive text-sm" role="alert">
          <ResumeCourseMessage status={status} />
        </p>
      )}
    </div>
  );
}

function ResumeCourseMessage({ status }: { status: string }) {
  const t = useExtracted();

  if (status === "completed") {
    return t("You've finished your selected path. Choose your next steps below.");
  }

  if (status === "limitReached") {
    return t(
      "You've reached today's limit for new learning plans. Try again tomorrow. You can still open lessons from your course.",
    );
  }

  return t("We couldn't prepare your next lesson. Please try again.");
}
