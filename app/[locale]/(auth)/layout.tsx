import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <Suspense>{children}</Suspense>
    </main>
  );
}
