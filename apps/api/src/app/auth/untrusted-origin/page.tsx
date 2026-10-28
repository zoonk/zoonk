import { AuthFrame } from "@/components/auth-frame";
import { Login, LoginDescription, LoginHeader, LoginTitle } from "@/components/login";
import { buttonVariants } from "@zoonk/ui/components/button";
import { MAIN_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";

export default async function UntrustedOriginPage() {
  const t = await getExtracted();

  return (
    <AuthFrame appUrl={MAIN_URL}>
      <Login>
        <LoginHeader>
          <LoginTitle>{t("Unable to redirect")}</LoginTitle>
          <LoginDescription>
            {t("The destination URL is not recognized as a trusted Zoonk application.")}
          </LoginDescription>
        </LoginHeader>

        <a className={buttonVariants()} href={MAIN_URL}>
          {t("Continue to Zoonk")}
        </a>
      </Login>
    </AuthFrame>
  );
}
