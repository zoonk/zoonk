import { AuthFrame } from "@/components/auth-frame";
import { Login, LoginHeader, LoginTitle } from "@/components/login";
import { buttonVariants } from "@zoonk/ui/components/button";
import { MAIN_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";

export default async function UntrustedOriginPage() {
  const t = await getExtracted();

  return (
    <AuthFrame appUrl={MAIN_URL}>
      <Login>
        <LoginHeader>
          <LoginTitle>{t("That link didn't work")}</LoginTitle>
        </LoginHeader>

        <a className={buttonVariants()} href={MAIN_URL}>
          {t("Go to Zoonk")}
        </a>
      </Login>
    </AuthFrame>
  );
}
