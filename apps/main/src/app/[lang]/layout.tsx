import { MainFeedbackProvider } from "@/components/feedback/main-feedback-provider";
import { MainSpeechProvider } from "@/components/speech/main-speech-provider";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { routing } from "@/i18n/routing";
import { Toaster } from "@zoonk/ui/components/toast";
import { getBaseUrl } from "@zoonk/utils/origin";
import { type Metadata } from "next";
import { lang } from "next/root-params";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AccountDeletedToast } from "./account-deleted-toast";
import { AppAnalytics } from "./app-analytics";
import { AppCommandPalette } from "./app-command-palette";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: { default: "Zoonk", template: "%s | Zoonk" },
};

/** Cmd/Ctrl+K for anyone with a session, streamed in after the page. */
function AppCommandPaletteSlot() {
  return (
    <Suspense fallback={null}>
      <AppCommandPalette />
    </Suspense>
  );
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <html lang={await lang()}>
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
        <Suspense fallback={null}>
          <AppAnalytics />
        </Suspense>
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
