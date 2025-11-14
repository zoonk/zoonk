"use cache";

import {
  IconBrandGithub,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandThreads,
  IconBrandTiktok,
  IconBrandX,
  IconBrandYoutube,
  IconWorld,
} from "@tabler/icons-react";
import { getPageBySlug } from "@zoonk/api/pages";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Container } from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { verifySession } from "@/lib/auth/dal";

type PageViewProps = PageProps<"/[locale]/p/[slug]">;

export async function generateMetadata({
  params,
}: PageViewProps): Promise<Metadata> {
  const { slug } = await params;

  cacheLife("max");
  cacheTag(`page-${slug}`);

  const page = await getPageBySlug(slug);

  if (!page) {
    return {
      title: "Page not found",
    };
  }

  return {
    description: page.description || `Visit ${page.name} on Zoonk`,
    title: page.name,
  };
}

export default async function PageView({ params }: PageViewProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(`page-${slug}`);

  const t = await getExtracted();
  const page = await getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  const session = await verifySession();
  const isAdmin =
    session.isAuth &&
    page.members.some((m) => m.userId === session.userId && m.role === "admin");

  const socialLinks = [
    { icon: IconWorld, label: "Website", url: page.website },
    { icon: IconBrandX, label: "X", url: page.xUrl },
    { icon: IconBrandInstagram, label: "Instagram", url: page.instagramUrl },
    { icon: IconBrandLinkedin, label: "LinkedIn", url: page.linkedinUrl },
    { icon: IconBrandThreads, label: "Threads", url: page.threadsUrl },
    { icon: IconBrandYoutube, label: "YouTube", url: page.youtubeUrl },
    { icon: IconBrandTiktok, label: "TikTok", url: page.tiktokUrl },
    { icon: IconBrandGithub, label: "GitHub", url: page.githubUrl },
  ].filter((link) => link.url) as Array<{
    url: string;
    icon: typeof IconWorld;
    label: string;
  }>;

  return (
    <Container className="py-8">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {page.image && (
              <div className="relative size-24 shrink-0 overflow-hidden rounded-lg">
                <Image
                  alt={page.name}
                  className="object-cover"
                  fill
                  src={page.image}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <h1 className="font-semibold text-3xl">{page.name}</h1>
              {socialLinks.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {socialLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <a
                        aria-label={link.label}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        href={link.url}
                        key={link.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Icon className="size-5" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "w-max")}
              href={`/p/${slug}/edit`}
            >
              {t("Edit page")}
            </Link>
          )}
        </div>

        {/* Description */}
        {page.description && (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-muted-foreground">{page.description}</p>
          </div>
        )}

        {/* Courses placeholder */}
        <div className="flex flex-col gap-4 rounded-lg border p-8">
          <h2 className="font-semibold text-xl">{t("Courses")}</h2>
          <p className="text-muted-foreground">
            {t("Courses created by this page will appear here.")}
          </p>
        </div>
      </div>
    </Container>
  );
}
