"use client";

import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";

function RequestErrorMessage({ status }: { status: string }) {
  const t = useExtracted();

  if (status === "unsafe") {
    return t("We can't help with this request. Try a different learning goal.");
  }

  if (status === "limitReached") {
    return t("You've made many requests today. Please try again later.");
  }

  return t("We couldn't prepare your next step. Please try again.");
}

export function LearningRequestFeedback({ status }: { status?: string }) {
  const t = useExtracted();

  if (!status) {
    return null;
  }

  if (status === "unauthorized") {
    return (
      <div className="flex flex-col items-center gap-3" role="status">
        <p className="text-muted-foreground text-center text-sm">
          {t(
            "Sign in to create a course or a personal learning path. Your request is saved in this browser.",
          )}
        </p>
        <Link className={buttonVariants()} href="/login?next=%2Fstart%2Flearn">
          {t("Sign in to continue")}
        </Link>
      </div>
    );
  }

  return (
    <p className="text-destructive text-center text-sm" role="alert">
      <RequestErrorMessage status={status} />
    </p>
  );
}
