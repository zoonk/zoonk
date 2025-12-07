import { getExtracted } from "next-intl/server";
import { SocialLogin } from "./social-login";

export default async function Login() {
  const t = await getExtracted();

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2">
        <h1 className="font-bold text-xl">{t("Access your account")}</h1>

        <p className="text-center text-sm">
          {t("Use your work or school account to sign in to the editor")}
        </p>
      </header>

      <SocialLogin />
    </main>
  );
}
