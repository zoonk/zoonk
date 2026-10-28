"use client";

import { PageErrorMessage } from "@/components/errors/page-error-message";
import { getPageRetry } from "@/components/errors/page-retry";
import { Link } from "@/i18n/navigation";
import { captureException } from "@sentry/nextjs";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect } from "react";

export default function PageError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useExtracted();

  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <PageErrorMessage
      homeLink={
        <Link className={buttonVariants({ variant: "ghost" })} href="/">
          {t("Go to the home page")}
        </Link>
      }
      onRetry={getPageRetry({ error, retry })}
    />
  );
}
