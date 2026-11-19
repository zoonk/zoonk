import { AuthDescription, AuthHeader, AuthTitle } from "@/components/auth-form";
import { AuthFrame } from "@/components/auth-frame";
import { MAIN_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";
import { ReturnToZoonk } from "./return-to-zoonk";

export default async function UntrustedOriginPage() {
  const t = await getExtracted();

  return (
    <AuthFrame
      appUrl={MAIN_URL}
      footer={<ReturnToZoonk href={MAIN_URL}>{t("Open Zoonk")}</ReturnToZoonk>}
    >
      <AuthHeader className="w-full items-start pb-8 text-start">
        <AuthTitle>{t("That link didn't work")}</AuthTitle>
        <AuthDescription>{t("Go to Zoonk and log in again.")}</AuthDescription>
      </AuthHeader>
    </AuthFrame>
  );
}
