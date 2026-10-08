import { AuthFrame } from "@/components/auth-frame";
import { Login, LoginDescription, LoginHeader, LoginTitle } from "@/components/login";
import { buttonVariants } from "@zoonk/ui/components/button";
import { MAIN_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";

/** A sign-in asked to return somewhere that isn't Zoonk: it says so and offers Zoonk instead. */
export default async function UntrustedOriginPage() {
  const t = await getExtracted();

  return (
    <AuthFrame>
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
