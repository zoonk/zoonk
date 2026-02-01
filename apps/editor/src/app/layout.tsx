import { FullPageLoading } from "@zoonk/ui/components/loading";
import { Toaster } from "@zoonk/ui/components/sonner";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://editor.zoonk.com"),
  title: {
    default: "Zoonk Editor",
    template: "%s | Editor",
  },
};

async function AppLayoutContent({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <Suspense fallback={<FullPageLoading />}>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}

export default function AppLayout(props: LayoutProps<"/">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <AppLayoutContent {...props} />
    </Suspense>
  );
}
