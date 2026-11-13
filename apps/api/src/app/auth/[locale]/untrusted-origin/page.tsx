import { AuthHeader, AuthTitle } from "@/components/auth-form";
import { AuthFrame } from "@/components/auth-frame";
import { Login } from "@/components/login";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { MAIN_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";

export default async function UntrustedOriginPage() {
  const t = await getExtracted();

  return (
    <AuthFrame appUrl={MAIN_URL}>
      <Login>
        <AuthHeader>
          <AuthTitle>{t("That link didn't work")}</AuthTitle>
        </AuthHeader>

        <a className={cn(buttonVariants({ size: "lg" }), "w-full")} href={MAIN_URL}>
          {t("Go to Zoonk")}
        </a>
      </Login>
    </AuthFrame>
  );
}
