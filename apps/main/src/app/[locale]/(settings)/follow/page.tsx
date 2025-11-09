"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cacheTagFollow } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSocialProfiles } from "@/lib/social";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/follow">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagFollow());

  const t = await getTranslations({ locale, namespace: "Follow" });

  return {
    description: t("metaDescription"),
    title: t("metaTitle"),
  };
}

export default async function Follow({
  params,
}: PageProps<"/[locale]/follow">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagFollow());

  const t = await getTranslations("Follow");

  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("title")}</ContainerTitle>
        <ContainerDescription>{t("subtitle")}</ContainerDescription>
      </ContainerHeader>

      <div className="grid w-full gap-4 sm:grid-cols-2 md:grid-cols-3">
        {getSocialProfiles(locale).map((social) => (
          <a
            className="flex items-center gap-3 rounded-lg border p-4 text-secondary-foreground/85 transition-colors hover:bg-accent"
            href={social.url}
            key={social.name}
            rel="noopener noreferrer"
            target="_blank"
          >
            <social.icon aria-hidden="true" size={32} />

            <div>
              <div className="font-semibold">{social.name}</div>

              <div className="text-muted-foreground text-sm">
                {social.handle}
              </div>
            </div>
          </a>
        ))}
      </div>
    </Container>
  );
}
