import { routing } from "@/i18n/routing";
import { Container } from "@zoonk/ui/components/container";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { type Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getExtracted, setRequestLocale } from "next-intl/server";
import "@zoonk/ui/globals.css";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    title: t("Sign in to Zoonk"),
  };
}

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <Suspense fallback={<FullPageLoading />}>
          <NextIntlClientProvider>
            <Container variant="centered">{children}</Container>
          </NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
