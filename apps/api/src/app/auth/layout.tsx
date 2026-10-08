import { FullPageLoading } from "@zoonk/ui/components/loading";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";
import "@zoonk/ui/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { title: t("Sign in to Zoonk") };
}

async function AuthLayoutContent({ children }: LayoutProps<"/auth">) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="bg-background sm:bg-muted font-sans antialiased">
        <Suspense fallback={<FullPageLoading />}>
          <NextIntlClientProvider>
            <main className="flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10">
              {children}
            </main>
          </NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  );
}

export default function AuthLayout(props: LayoutProps<"/auth">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <AuthLayoutContent {...props} />
    </Suspense>
  );
}
