import { getTranslations } from "next-intl/server";
import { SocialLogin } from "./SocialLogin";

export default async function LoginHeader() {
  const t = await getTranslations("Auth");

  return (
    <>
      <header className="flex flex-col items-center gap-2">
        <h1 className="font-bold text-xl">{t("title")}</h1>
        <p className="text-center text-sm">{t("subtitle")}</p>
      </header>

      <SocialLogin />

      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t">
        <span className="relative z-10 bg-background px-2 text-muted-foreground">
          {t("socialOr")}
        </span>
      </div>
    </>
  );
}
