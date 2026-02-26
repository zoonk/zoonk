"use client";

import { Link, redirect } from "@/i18n/navigation";
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
import { useExtracted, useLocale } from "next-intl";
import { use, useEffect, useEffectEvent, useState } from "react";

type CallbackErrorType = "invalid";

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
            {type === "invalid" &&
              t("The authentication token is invalid or expired. Please try logging in again.")}
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Link className={buttonVariants({ variant: "outline" })} href="/login">
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

export default function AuthCallbackPage(props: PageProps<"/[locale]/auth/callback/[token]">) {
  const { token } = use(props.params);
  const locale = useLocale();
  const [error, setError] = useState<CallbackErrorType | null>(null);

  const handleVerify = useEffectEvent(async (userToken: string) => {
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
    void handleVerify(token);
  }, [token]);

  if (error) {
    return <CallbackError type={error} />;
  }

  return <FullPageLoading />;
}
