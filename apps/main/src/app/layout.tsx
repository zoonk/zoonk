import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@zoonk/ui/components/sonner";
import { SITE_URL } from "@zoonk/utils/url";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Zoonk", template: "%s | Zoonk" },
};

const googleAdsTagId = process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID;

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
          <Analytics debug={false} />
          <Toaster />
        </body>
        {googleAdsTagId && <GoogleAnalytics gaId={googleAdsTagId} />}
      </HtmlDocument>
    </Suspense>
  );
}
