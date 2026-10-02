import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { getExperienceMode } from "@/lib/learn/experience-mode";
import { DeviceModeRoot, ModeProvider } from "@zoonk/learn/mode";
import { LearnShell } from "@zoonk/learn/shell";
import { Suspense } from "react";
import { SettingsNavbar, SettingsNavbarSkeleton } from "./_components/settings-navbar";

const SHELL_CLASS = "gap-4 overflow-x-clip pb-12";

/** Settings keep the learner's appearance in their own shell, with a link home to leave it. */
async function SettingsFrame({ children }: { children: React.ReactNode }) {
  const mode = await getExperienceMode();

  return (
    <ModeProvider experienceMode={mode}>
      <LearnShell className={SHELL_CLASS}>
        <Suspense fallback={<SettingsNavbarSkeleton />}>
          <SettingsNavbar />
        </Suspense>
        {children}
      </LearnShell>
    </ModeProvider>
  );
}

export default function Layout({ children }: LayoutProps<"/[lang]">) {
  return (
    <ClientMessagesProvider scope="learn">
      <Suspense
        fallback={
          <DeviceModeRoot>
            <LearnShell className={SHELL_CLASS}>
              <SettingsNavbarSkeleton />
            </LearnShell>
          </DeviceModeRoot>
        }
      >
        <SettingsFrame>{children}</SettingsFrame>
      </Suspense>
    </ClientMessagesProvider>
  );
}
