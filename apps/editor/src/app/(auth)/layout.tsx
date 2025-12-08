import { buttonVariants } from "@zoonk/ui/components/button";
import { FullPageContainer } from "@zoonk/ui/components/container";
import { LoginNav } from "@zoonk/ui/patterns/auth/login";
import { HomeIcon } from "lucide-react";
import Link from "next/link";
import { getExtracted } from "next-intl/server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getExtracted();

  return (
    <FullPageContainer>
      <LoginNav>
        <Link
          className={buttonVariants({ size: "icon", variant: "outline" })}
          href="/"
        >
          <HomeIcon aria-hidden="true" />
          <span className="sr-only">{t("Home page")}</span>
        </Link>
      </LoginNav>

      {children}
    </FullPageContainer>
  );
}
