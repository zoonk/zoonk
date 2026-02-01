import { FullPageLoading } from "@zoonk/ui/components/loading";
import { Toaster } from "@zoonk/ui/components/sonner";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { Suspense } from "react";
import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://editor.zoonk.com"),
  title: {
    default: "Zoonk Editor",
    template: "%s | Editor",
  },
};

export default function LocaleLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Suspense fallback={<FullPageLoading />}>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
