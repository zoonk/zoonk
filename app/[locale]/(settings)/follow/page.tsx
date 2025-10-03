"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { PageSubtitle } from "@/components/PageSubtitle";
import { PageTitle } from "@/components/PageTitle";
import { getSocialProfiles } from "@/lib/social";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/follow">): Promise<Metadata> {
  cacheLife("max");
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Follow" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Follow({
  params,
}: PageProps<"/[locale]/follow">) {
  cacheLife("max");
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Follow");

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t("title")}</PageTitle>
        <PageSubtitle>{t("subtitle")}</PageSubtitle>
      </PageHeader>

      <div className="grid w-full gap-4 sm:grid-cols-2 md:grid-cols-3">
        {getSocialProfiles(locale).map((social) => (
          <a
            key={social.name}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border p-4 text-secondary-foreground/85 transition-colors hover:bg-accent"
          >
            <social.icon size={32} aria-hidden="true" />

            <div>
              <div className="font-semibold">{social.name}</div>

              <div className="text-muted-foreground text-sm">
                {social.handle}
              </div>
            </div>
          </a>
        ))}
      </div>
    </PageContainer>
  );
}
