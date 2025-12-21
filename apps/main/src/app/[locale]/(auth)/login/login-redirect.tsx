"use client";

import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useEffect } from "react";

type LoginRedirectProps = {
  url: string;
};

export function LoginRedirect({ url }: LoginRedirectProps) {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return <FullPageLoading />;
}
