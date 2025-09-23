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
    <main className="bg-background w-full max-w-sm flex min-h-svh flex-col mx-auto items-center justify-center gap-6 p-6 md:p-10">
      <Suspense>{children}</Suspense>
    </main>
  );
}
