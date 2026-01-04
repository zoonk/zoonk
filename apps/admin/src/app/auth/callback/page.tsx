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
import Link from "next/link";
import { redirect, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useState } from "react";

type CallbackErrorType = "missing" | "invalid";

function CallbackError({ type }: { type: CallbackErrorType }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Authentication Error</EmptyTitle>
          <EmptyDescription>
            {type === "missing"
              ? "The authentication token is missing. Please try logging in again."
              : "The authentication token is invalid or expired. Please try logging in again."}
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/login"
          >
            Return to login
          </Link>
          <p className="text-muted-foreground text-sm">
            Need help? Contact us at hello@zoonk.com
          </p>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function CallbackHandler() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
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

    redirect("/");
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
