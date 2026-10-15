import { MainFeedbackProvider } from "@/components/feedback/main-feedback-provider";
import { MainSpeechProvider } from "@/components/speech/main-speech-provider";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { routing } from "@/i18n/routing";
import { geistMono, geistSans } from "@/lib/fonts";
import { Toaster } from "@zoonk/ui/components/toast";
import { getBaseUrl } from "@zoonk/utils/origin";
import { type Metadata } from "next";
import { lang } from "next/root-params";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AccountDeletedToast } from "./account-deleted-toast";
import { AppAnalytics } from "./app-analytics";
import { AppCommandPalette } from "./app-command-palette";
import { IdentityCoverBridge } from "./identity-cover-bridge";
import { IdentityCoverScript } from "./identity-cover-script";
import { LearnerSummarySync } from "./learner-summary-sync";
import { PaletteRequestReset } from "./palette-request-reset";
import { SignedInHintScript } from "./signed-in-hint-script";
import "../globals.css";

/**
 * Every page's App Shell (what a default `<Link>` prefetches) stays static: request-time content
 * behind Suspense comes with the link's own prefetch or the navigation, so a link in sight never
 * costs a server render for its shell.
 */
export const ensureStatic = "shell";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: { default: "Zoonk", template: "%s | Zoonk" },
};

/**
 * Cmd/Ctrl+K from anywhere, and what keeps a "Search" chosen before the palette loaded from opening
 * on another page. The reset comes first, so on a commit that both changes the page and mounts the
 * palette, it drops the old request before the palette can answer it.
 */
function AppCommandPaletteSlot() {
  return (
    <>
      <Suspense fallback={null}>
        <PaletteRequestReset />
      </Suspense>
      <AppCommandPalette />
    </>
  );
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await lang();

  return (
    // The hint script marks `<html>` before React hydrates it.
    <html
      className={`${geistSans.variable} ${geistMono.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <SignedInHintScript />
        <IdentityCoverScript />
      </head>
      <body className="font-sans antialiased">
        {/* First, so the toast region listens before any page's first effects add a toast (the
            confirmation of a deleted account, shown as the home page loads). */}
        <Toaster />
        <NuqsAdapter>
          <ClientMessagesProvider scope="site">
            <MainFeedbackProvider>
              <MainSpeechProvider>{children}</MainSpeechProvider>
              <AppCommandPaletteSlot />
              <AccountDeletedToast />
            </MainFeedbackProvider>
          </ClientMessagesProvider>
        </NuqsAdapter>
        <IdentityCoverBridge />
        <Suspense fallback={null}>
          <LearnerSummarySync />
        </Suspense>
        <AppAnalytics locale={locale} />
      </body>
    </html>
  );
}

/**
 * Pre-render every supported language so the root parameter is available to
 * statically rendered pages without duplicating the locale list in the app.
 */
export function generateStaticParams() {
  return routing.locales.map((language) => ({ lang: language }));
}
