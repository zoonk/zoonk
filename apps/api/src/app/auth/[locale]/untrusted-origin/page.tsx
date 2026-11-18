import { AuthDescription, AuthHeader, AuthTitle } from "@/components/auth-form";
import { AuthFrame } from "@/components/auth-frame";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { EnterLink } from "@zoonk/ui/components/enter-button";
import { DocumentLink } from "@zoonk/ui/patterns/links/pending";
import { MAIN_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";

async function ReturnToZoonk() {
  const t = await getExtracted();

  return (
    <div className="mt-auto w-full [--page-measure:360px]">
      <BottomBar className="mx-auto">
        <BottomBarActions>
          <EnterLink href={MAIN_URL} link={DocumentLink} size="lg">
            {t("Go to Zoonk")}
          </EnterLink>
        </BottomBarActions>
      </BottomBar>
    </div>
  );
}

export default async function UntrustedOriginPage() {
  const t = await getExtracted();

  return (
    <AuthFrame appUrl={MAIN_URL} footer={<ReturnToZoonk />}>
      <AuthHeader className="w-full items-start pb-8 text-start">
        <AuthTitle>{t("That link didn't work")}</AuthTitle>
        <AuthDescription>{t("Go to Zoonk and log in again.")}</AuthDescription>
      </AuthHeader>
    </AuthFrame>
  );
}
