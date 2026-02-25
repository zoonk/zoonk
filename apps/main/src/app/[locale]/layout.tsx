import { routing } from "@/i18n/routing";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@zoonk/ui/components/sonner";
import { SITE_URL } from "@zoonk/utils/constants";
import { type Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "",
    template: "%s | Zoonk",
  },
};

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
        <NuqsAdapter>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </NuqsAdapter>
        <Analytics />
        <Toaster />
      </body>
    </html>
  );
}
