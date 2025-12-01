import { buttonVariants } from "@zoonk/ui/components/button";
import { LayoutTemplateIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { Header } from "../header";

const homeMenu = getMenu("home");

type EditorHeaderProps = React.ComponentProps<"header"> & {
  active: "overview";
  orgSlug?: string;
};

export async function EditorHeader({
  active,
  children,
  orgSlug,
}: EditorHeaderProps) {
  const t = await getExtracted();

  return (
    <Header>
      <Link
        className={buttonVariants({
          size: "icon",
          variant: "outline",
        })}
        href={homeMenu.url}
      >
        <homeMenu.icon aria-hidden="true" />
        <span className="sr-only">{t("Home page")}</span>
      </Link>

      {orgSlug && (
        <Link
          className={buttonVariants({
            size: "icon",
            variant: active === "overview" ? "default" : "outline",
          })}
          href={`/editor/${orgSlug}`}
        >
          <LayoutTemplateIcon aria-hidden="true" />
          <span className="sr-only">{t("Editor")}</span>
        </Link>
      )}

      <div className="ml-auto flex items-center gap-2">{children}</div>
    </Header>
  );
}
