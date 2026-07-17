import { OneTimeTokenLoginRedirect } from "@zoonk/core/auth/ott/login";
import { FullPageLoading } from "@zoonk/ui/components/loading";

export const prefetch = "allow-runtime";

export default function LoginPage() {
  return (
    <>
      <OneTimeTokenLoginRedirect callbackPath="/auth/callback" />
      <FullPageLoading />
    </>
  );
}
