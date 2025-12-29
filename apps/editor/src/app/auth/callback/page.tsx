import { FullPageLoading } from "@zoonk/ui/components/loading";
import { Suspense } from "react";
import { CallbackHandler } from "./callback-handler";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <CallbackHandler />
    </Suspense>
  );
}
