import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { LearnFrame } from "./(learn)/_components/learn-frame";

/**
 * One frame for every page of the app (the tabs and the pages they open, statistics, settings and
 * the catalog), so moving between them only swaps the page: the sidebar, the bars and the tab bar
 * stay mounted, and each page's prefetch carries just its own content.
 */
export default function AppLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <ClientMessagesProvider scope="learn">
      <LearnFrame>{children}</LearnFrame>
    </ClientMessagesProvider>
  );
}
