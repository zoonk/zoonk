import { LearnFrame } from "@/app/[lang]/(learn)/_components/learn-frame";
import { LearnFrameSkeleton } from "@/app/[lang]/(learn)/_components/learn-frame-skeleton";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { Suspense } from "react";
import { SettingsNavbar, SettingsNavbarSkeleton } from "./_components/settings-navbar";

/**
 * Settings sit under the same top bar as the learning tabs, in the learner's mode, with the
 * settings pills to move between pages. Each page sets its own width below them.
 */
export default function Layout({ children }: LayoutProps<"/[lang]">) {
  return (
    <ClientMessagesProvider scope="learn">
      <Suspense fallback={<LearnFrameSkeleton />}>
        <LearnFrame column={false}>
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 overflow-x-hidden pb-12 in-data-[mode=fun]:pb-32 lg:in-data-[mode=fun]:pb-12">
            <Suspense fallback={<SettingsNavbarSkeleton />}>
              <SettingsNavbar />
            </Suspense>
            {children}
          </div>
        </LearnFrame>
      </Suspense>
    </ClientMessagesProvider>
  );
}
