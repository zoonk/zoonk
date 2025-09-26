import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "./ui/button";

interface LoginButtonProps {
  locale: string;
}

export async function LoginButton({ locale }: LoginButtonProps) {
  "use cache";
  cacheLife("max");
  setRequestLocale(locale);

  const t = await getTranslations("Menu");

  return (
    <Link href="/login" className={buttonVariants()}>
      {t("login")}
    </Link>
  );
}
