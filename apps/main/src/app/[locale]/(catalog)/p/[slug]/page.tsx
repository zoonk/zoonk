"use cache";

import { getPageBySlug } from "@zoonk/api/pages";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Container } from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";
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
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { getExtracted, setRequestLocale } from "next-intl/server";
import Image from "next/image";
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
    { url: page.website, icon: IconWorld, label: "Website" },
    { url: page.xUrl, icon: IconBrandX, label: "X" },
    { url: page.instagramUrl, icon: IconBrandInstagram, label: "Instagram" },
    { url: page.linkedinUrl, icon: IconBrandLinkedin, label: "LinkedIn" },
    { url: page.threadsUrl, icon: IconBrandThreads, label: "Threads" },
    { url: page.youtubeUrl, icon: IconBrandYoutube, label: "YouTube" },
    { url: page.tiktokUrl, icon: IconBrandTiktok, label: "TikTok" },
    { url: page.githubUrl, icon: IconBrandGithub, label: "GitHub" },
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
                  src={page.image}
                  alt={page.name}
                  fill
                  className="object-cover"
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
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={link.label}
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
              href={`/p/${slug}/edit`}
              className={cn(buttonVariants({ variant: "outline" }), "w-max")}
            >
              {t("Edit page")}
            </Link>
          )}
        </div>

        {/* Description */}
        {page.description && (
          <div className="prose prose-neutral max-w-none dark:prose-invert">
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
