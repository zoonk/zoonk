import { Toaster } from "@zoonk/ui/components/sonner";
import { SITE_URL } from "@zoonk/utils/url";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AppAnalytics } from "./app-analytics";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Zoonk", template: "%s | Zoonk" },
};

async function HtmlDocument({ children }: React.PropsWithChildren) {
  const locale = await getLocale();
  return <html lang={locale}>{children}</html>;
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <HtmlDocument>
        <body className="font-sans antialiased">
          <NuqsAdapter>
            <NextIntlClientProvider>{children}</NextIntlClientProvider>
          </NuqsAdapter>
          <Suspense fallback={null}>
            <AppAnalytics />
          </Suspense>
          <Toaster />
        </body>
      </HtmlDocument>
    </Suspense>
  );
}
