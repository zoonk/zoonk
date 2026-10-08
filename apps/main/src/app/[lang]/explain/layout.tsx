import { ClientMessagesProvider } from "@/i18n/client-messages-provider";

/** Explanations play in the lesson player, so this route gets the player and learn catalogs. */
export default function Layout({ children }: LayoutProps<"/[lang]/explain">) {
  return <ClientMessagesProvider scope="player">{children}</ClientMessagesProvider>;
}
