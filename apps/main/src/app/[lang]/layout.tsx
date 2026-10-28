import { MainFeedbackProvider } from "@/components/feedback/main-feedback-provider";
import { MainSpeechProvider } from "@/components/speech/main-speech-provider";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { routing } from "@/i18n/routing";
import { geistMono, geistSans } from "@/lib/fonts";
import { RefreshStalePages } from "@/lib/http/refresh-stale-pages";
import { Toaster } from "@zoonk/ui/components/toast";
import { getBaseUrl } from "@zoonk/utils/origin";
import { type Metadata } from "next";
import { lang } from "next/root-params";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AccountDeletedToast } from "./account-deleted-toast";
import { AppAnalytics } from "./app-analytics";
import { AppCommandPalette } from "./app-command-palette";
import { AuthChangeReload } from "./auth-change-reload";
import { KeepTypingScript } from "./keep-typing-script";
import { LearnerSummarySync } from "./learner-summary-sync";
import { PaletteRequestReset } from "./palette-request-reset";
import { SignedInHintScript } from "./signed-in-hint-script";
import "../globals.css";

export const ensureStatic = "shell";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: { default: "Zoonk", template: "%s | Zoonk" },
};

/** The reset comes first, so a commit that changes the page and mounts the palette drops the old request first. */
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
        <KeepTypingScript />
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
        <AuthChangeReload />
        <Suspense fallback={null}>
          <LearnerSummarySync />
          <RefreshStalePages />
        </Suspense>
        <AppAnalytics locale={locale} />
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((language) => ({ lang: language }));
}
