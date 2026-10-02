"use client";

import { PageErrorMessage } from "@/components/errors/page-error-message";
import { Link } from "@/i18n/navigation";
import { captureException } from "@sentry/nextjs";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect } from "react";

/** A page that failed inside the app keeps the app's document and links home through the router. */
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
        <Link className={buttonVariants({ size: "lg", variant: "outline" })} href="/">
          {t("Go to the home page")}
        </Link>
      }
      onRetry={retry}
    />
  );
}
