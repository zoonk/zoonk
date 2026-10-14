import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

/** A language unit plays its words and sentences with the lesson player's components. */
export default function Layout({ children }: LayoutProps<"/[lang]/content/units/[chapterId]">) {
  return <ClientMessagesProvider scope="player">{children}</ClientMessagesProvider>;
}
