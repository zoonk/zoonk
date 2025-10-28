import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function LoginFooter() {
  const t = await getTranslations("Auth");

  return (
    <footer className="text-balance text-center text-muted-foreground text-xs *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary">
      {t.rich("terms", {
        privacy: (children) => <Link href="/privacy">{children}</Link>,
        terms: (children) => <Link href="/terms">{children}</Link>,
      })}
    </footer>
  );
}
