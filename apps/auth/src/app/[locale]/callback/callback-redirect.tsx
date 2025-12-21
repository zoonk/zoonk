"use client";

import { FullPageLoading } from "@zoonk/ui/components/loading";
import { useEffect } from "react";

type CallbackRedirectProps = {
  url: string;
};

export function CallbackRedirect({ url }: CallbackRedirectProps) {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return <FullPageLoading />;
}
