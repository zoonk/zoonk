import { getAuthPageLocale } from "@/i18n/page-locale";
import { KEEP_TYPING_SCRIPT } from "@zoonk/ui/lib/kept-typing-script";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getExtracted } from "next-intl/server";
import "@zoonk/ui/globals.css";

/** Apps open these pages in a new document, so the CDN must answer before any function runs. */
export const ensureStatic = "shell";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((supported) => ({ locale: supported }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { title: t("Sign in to Zoonk") };
}

export default async function AuthLayout({ children }: LayoutProps<"/auth/[locale]">) {
  const appLocale = await getAuthPageLocale();

  return (
    <html lang={appLocale}>
      <head>
        <script
          // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
          dangerouslySetInnerHTML={{ __html: KEEP_TYPING_SCRIPT }}
        />
      </head>
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
