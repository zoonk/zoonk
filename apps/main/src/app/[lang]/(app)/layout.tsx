import { LinkIntentPreloads } from "@/components/learn/link-intent-preloads";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { LearnFrame } from "./(learn)/_components/learn-frame";

/** One frame, so the sidebar and bars stay mounted and each page's prefetch carries just its own content. */
export default function AppLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <ClientMessagesProvider scope="learn">
      <LinkIntentPreloads />
      <LearnFrame>{children}</LearnFrame>
    </ClientMessagesProvider>
  );
}
