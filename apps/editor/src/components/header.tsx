import { buttonVariants } from "@zoonk/ui/components/button";
import { Header } from "@zoonk/ui/components/header";
import { HomeIcon } from "lucide-react";
import Link from "next/link";
import { getExtracted } from "next-intl/server";

type EditorHeaderProps = React.ComponentProps<"header"> & {
  active: "home" | "courses";
  orgSlug?: string;
};

export async function EditorHeader({ active, children }: EditorHeaderProps) {
  const t = await getExtracted();

  return (
    <Header>
      <Link
        className={buttonVariants({
          size: "icon",
          variant: active === "home" ? "default" : "outline",
        })}
        href="/"
      >
        <HomeIcon aria-hidden="true" />
        <span className="sr-only">{t("Home page")}</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">{children}</div>
    </Header>
  );
}
