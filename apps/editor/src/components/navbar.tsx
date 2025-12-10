import { buttonVariants } from "@zoonk/ui/components/button";
import { Navbar } from "@zoonk/ui/components/navbar";
import { HomeIcon } from "lucide-react";
import Link from "next/link";
import { getExtracted } from "next-intl/server";
import { BackButton } from "./back";

type EditorNavbarProps = React.ComponentProps<"nav"> & {
  active: "home" | "courses";
  orgSlug?: string;
};

export async function EditorNavbar({
  active,
  children,
  ...props
}: EditorNavbarProps) {
  const t = await getExtracted();

  return (
    <Navbar {...props}>
      {active !== "home" && <BackButton />}

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
    </Navbar>
  );
}
