import { buttonVariants } from "@zoonk/ui/components/button";
import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Header } from "@/components/header";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";

const homeMenu = getMenu("home");

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/editor/[orgSlug]">): Promise<Metadata> {
  "use cache";

  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    title: t("Editor"),
  };
}

export default async function EditorOverview() {
  return (
    <>
      <Header>
        <Link
          className={buttonVariants({
            size: "icon",
            variant: "outline",
          })}
          href={homeMenu.url}
        >
          <homeMenu.icon aria-hidden="true" />
        </Link>
      </Header>

      <main>{}</main>
    </>
  );
}
