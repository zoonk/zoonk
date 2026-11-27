import { getAuthPageLocale } from "@/i18n/page-locale";
import { HeldPressCommit } from "@zoonk/ui/components/held-press-commit";
import { Toaster } from "@zoonk/ui/components/toast";
import { FONT_VARIABLES } from "@zoonk/ui/fonts";
import { HELD_PRESS_SCRIPT } from "@zoonk/ui/lib/held-press-script";
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

  return { title: t("Log in to Zoonk") };
}

export default async function AuthLayout({ children }: LayoutProps<"/auth/[locale]">) {
  const appLocale = await getAuthPageLocale();

  return (
    <html className={FONT_VARIABLES} lang={appLocale}>
      <head>
        <script
          // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
          dangerouslySetInnerHTML={{ __html: KEEP_TYPING_SCRIPT }}
        />
        <script
          // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
          dangerouslySetInnerHTML={{ __html: HELD_PRESS_SCRIPT }}
        />
      </head>
      <body className="bg-background font-sans antialiased">
        <NextIntlClientProvider>
          <main className="relative flex min-h-dvh w-full flex-col items-center px-4 pt-28 pb-0 [--page-dock:0px] [--page-gutter:--spacing(4)]">
            {children}
          </main>
          <Toaster />
          <HeldPressCommit />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
