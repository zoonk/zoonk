import { Login, LoginDescription, LoginHeader, LoginTitle } from "@/components/login";
import { Alert, AlertDescription, AlertTitle } from "@zoonk/ui/components/alert";
import { buttonVariants } from "@zoonk/ui/components/button";
import { TriangleAlertIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export default async function UntrustedOriginPage() {
  const t = await getExtracted();

  return (
    <Login>
      <LoginHeader>
        <LoginTitle>{t("Unable to redirect")}</LoginTitle>
        <LoginDescription>
          {t("The destination URL is not recognized as a trusted Zoonk application.")}
        </LoginDescription>
      </LoginHeader>

      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>{t("Security warning")}</AlertTitle>
        <AlertDescription>
          {t("For your safety, we cannot redirect you to an unrecognized destination.")}
        </AlertDescription>
      </Alert>

      <a className={buttonVariants()} href="https://www.zoonk.com">
        {t("Continue to Zoonk")}
      </a>
    </Login>
  );
}
