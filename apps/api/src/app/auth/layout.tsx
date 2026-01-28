import { Container } from "@zoonk/ui/components/container";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getExtracted, getLocale } from "next-intl/server";
import "@zoonk/ui/globals.css";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    title: t("Sign in to Zoonk"),
  };
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

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
