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
import { getExtracted, setRequestLocale } from "next-intl/server";
import { getSocialProfiles } from "@/lib/social";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/follow">): Promise<Metadata> {
  const { locale } = await params;

  cacheLife("max");
  cacheTag(locale, cacheTagFollow());

  const t = await getExtracted({ locale });

  return {
    description: t(
      "Connect with Zoonk across social media. Follow us on X, LinkedIn, YouTube, and more to stay updated on new features, tips, and learning content.",
    ),
    title: t("Follow us on social media"),
  };
}

export default async function Follow({
  params,
}: PageProps<"/[locale]/follow">) {
  const { locale } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagFollow());

  const t = await getExtracted();

  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>{t("Follow us")}</ContainerTitle>
        <ContainerDescription>
          {t("Find all our social media links and keep in touch with us.")}
        </ContainerDescription>
      </ContainerHeader>

      <div className="grid w-full gap-4 sm:grid-cols-2 md:grid-cols-3">
        {getSocialProfiles(locale).map((social) => (
          <a
            className="flex items-center gap-3 rounded-lg border p-4 text-secondary-foreground/70 transition-colors hover:bg-accent"
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
