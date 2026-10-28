import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";
import "@zoonk/ui/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { title: t("Sign in to Zoonk") };
}

/** Only the background shows while the request's language is read, so no loading screen flashes. */
function AuthBackground() {
  return <div aria-hidden="true" className="bg-background fixed inset-0" />;
}

async function AuthDocument({ children }: LayoutProps<"/auth">) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="bg-background font-sans antialiased">
        <NextIntlClientProvider>
          <main className="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-16">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export default function AuthLayout(props: LayoutProps<"/auth">) {
  return (
    <Suspense fallback={<AuthBackground />}>
      <AuthDocument {...props} />
    </Suspense>
  );
}
