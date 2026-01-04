"use client";

import { authClient } from "@zoonk/core/auth/client";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { AlertCircleIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import { Suspense, useEffect, useEffectEvent, useState } from "react";
import { Link, redirect } from "@/i18n/navigation";

type CallbackErrorType = "missing" | "invalid";

function CallbackError({ type }: { type: CallbackErrorType }) {
  const t = useExtracted();

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("Authentication Error")}</EmptyTitle>
          <EmptyDescription>
            {type === "missing"
              ? t(
                  "The authentication token is missing. Please try logging in again.",
                )
              : t(
                  "The authentication token is invalid or expired. Please try logging in again.",
                )}
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/login"
          >
            {t("Return to login")}
          </Link>
          <p className="text-muted-foreground text-sm">
            {t("Need help? Contact us at hello@zoonk.com")}
          </p>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function CallbackHandler() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const token = searchParams.get("token");
  const [error, setError] = useState<CallbackErrorType | null>(null);

  const handleVerify = useEffectEvent(async (userToken: string) => {
    // we're using a client component to properly set session cookies after token verification
    // on server-side, the session cookies aren't set
    const { error: verifyError } = await authClient.oneTimeToken.verify({
      token: userToken,
    });

    if (verifyError) {
      console.info("Failed to verify one-time token:", verifyError);
      setError("invalid");
      return;
    }

    redirect({ href: "/", locale });
  });

  useEffect(() => {
    if (token) {
      void handleVerify(token);
    } else {
      console.info("Auth callback: missing token");
      setError("missing");
    }
  }, [token]);

  if (error) {
    return <CallbackError type={error} />;
  }

  return <FullPageLoading />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler />
    </Suspense>
  );
}
