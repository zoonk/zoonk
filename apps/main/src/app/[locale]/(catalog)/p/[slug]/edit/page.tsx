"use cache";

import { checkUserIsPageAdmin, getPageBySlug } from "@zoonk/api/pages";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound, unauthorized } from "next/navigation";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { verifySession } from "@/lib/auth/dal";
import { EditForm } from "./edit-form";

type EditPageProps = PageProps<"/[locale]/p/[slug]/edit">;

export async function generateMetadata({
  params,
}: EditPageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  cacheLife("max");
  cacheTag(`page-${slug}`);

  const t = await getExtracted({ locale });
  const page = await getPageBySlug(slug);

  if (!page) {
    return {
      title: t("Page not found"),
    };
  }

  return {
    description: t("Edit page settings and information"),
    title: t("Edit {pageName}", { pageName: page.name }),
  };
}

export default async function EditPage({ params }: EditPageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(`page-${slug}`);

  const t = await getExtracted();

  // Check authentication
  const session = await verifySession();
  if (!(session.isAuth && session.userId)) {
    unauthorized();
  }

  // Get page
  const page = await getPageBySlug(slug);
  if (!page) {
    notFound();
  }

  // Check authorization
  const isAdmin = await checkUserIsPageAdmin(slug, session.userId);
  if (!isAdmin) {
    unauthorized();
  }

  return (
    <Container className="py-8">
      <ContainerHeader>
        <ContainerTitle>{t("Edit page")}</ContainerTitle>
        <ContainerDescription>
          {t("Update your page information and settings")}
        </ContainerDescription>
      </ContainerHeader>

      <EditForm
        description={page.description}
        githubUrl={page.githubUrl}
        image={page.image}
        instagramUrl={page.instagramUrl}
        linkedinUrl={page.linkedinUrl}
        name={page.name}
        slug={page.slug}
        threadsUrl={page.threadsUrl}
        tiktokUrl={page.tiktokUrl}
        website={page.website}
        xUrl={page.xUrl}
        youtubeUrl={page.youtubeUrl}
      />
    </Container>
  );
}
