import { OneTimeTokenLoginRedirect } from "@zoonk/core/auth/ott/login";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";

export default function LoginPage() {
  return (
    <>
      <OneTimeTokenLoginRedirect callbackPath="/auth/callback" locale={DEFAULT_LOCALE} />
      <FullPageLoading />
    </>
  );
}
