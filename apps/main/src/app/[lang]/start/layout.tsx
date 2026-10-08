import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { OnboardingChromeProvider } from "@zoonk/learn/onboarding/frame";
import { Suspense } from "react";
import { StartChrome, StartChromeSkeleton } from "./_components/start-chrome";

/**
 * Every onboarding page shows the app's own bar (`StartChrome`), placed by each screen, and gets
 * the learn catalog, since learn screens render here.
 */
export default function Layout({ children }: LayoutProps<"/[lang]/start">) {
  return (
    <ClientMessagesProvider scope="learn">
      <OnboardingChromeProvider
        chrome={
          <Suspense fallback={<StartChromeSkeleton />}>
            <StartChrome />
          </Suspense>
        }
      >
        {children}
      </OnboardingChromeProvider>
    </ClientMessagesProvider>
  );
}
